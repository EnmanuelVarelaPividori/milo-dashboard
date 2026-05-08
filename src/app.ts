import Fastify from 'fastify';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { checkDbConnection } from './lib/db.js';
import {
  buildDiscordOauthUrl,
  createOauthState,
  createSignedToken,
  exchangeDiscordCode,
  fetchDiscordUser,
  getDiscordAuthConfig,
  getOauthStateCookieName,
  getSessionCookieName,
  parseCookieHeader,
  serializeCookie,
  toAuthUser,
  verifySignedToken,
  type AuthUser,
} from './lib/auth.js';
import { createPostgresStore, type CreateTicketRunInput, type DashboardStore } from './lib/store.js';
import { createCronJobsService, type CronJobsService } from './services/cron-jobs.js';
import { buildSessionId, createOpenClawChatService, type ChatService } from './services/chat.js';
import { renderChatPage, renderDashboardPage, renderLoginPage } from './ui/pages.js';

const CHAT_ENABLED = false;

type BuildAppOptions = {
  store?: DashboardStore;
  dbHealthcheck?: () => Promise<void>;
  chatService?: ChatService;
  cronJobsService?: CronJobsService;
};

const createJobSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  schedule: z.string().min(1),
  enabled: z.boolean().optional(),
  nextRunAt: z.string().datetime().nullable().optional(),
});

const createJobRunSchema = z.object({
  jobKey: z.string().min(1),
  status: z.string().min(1),
  summary: z.string().optional(),
  error: z.string().optional(),
  finishedAt: z.string().datetime().nullable().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

const createTicketRunSchema = z.object({
  jobRunId: z.string().uuid().nullable().optional(),
  jiraKey: z.string().min(1),
  jiraSummary: z.string().nullable().optional(),
  jiraStatus: z.string().nullable().optional(),
  dispatchStatus: z.string().min(1),
  score: z.number().int().nullable().optional(),
  branchName: z.string().nullable().optional(),
  prUrl: z.string().url().nullable().optional(),
  note: z.string().nullable().optional(),
  testSummary: z.string().nullable().optional(),
  finishedAt: z.string().datetime().nullable().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

const limitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const chatBodySchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).optional(),
});

const chatHistoryQuerySchema = z.object({
  conversationId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).optional(),
});

const renameChatSessionSchema = z.object({
  title: z.string().trim().min(1).max(80),
});

const runJobBodySchema = z.object({
  key: z.string().min(1),
});

const jobActivityQuerySchema = z.object({
  key: z.string().min(1),
});

function getRequestUser(cookieHeader: string | undefined, sessionSecret: string) {
  const cookies = parseCookieHeader(cookieHeader);
  const token = cookies[getSessionCookieName()];
  if (!token) return null;
  return verifySignedToken<AuthUser>(token, sessionSecret);
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: true });
  const store = options.store ?? createPostgresStore();
  const dbHealthcheck = options.dbHealthcheck ?? checkDbConnection;
  const chatService = options.chatService ?? createOpenClawChatService();
  const cronJobsService = options.cronJobsService ?? createCronJobsService();
  const auth = getDiscordAuthConfig();
  const internalIngestToken = process.env.MILO_DASHBOARD_INGEST_TOKEN?.trim() || null;
  const assetsDir = path.join(process.cwd(), 'src', 'ui', 'assets');
  const assetFiles = new Map([
    ['/assets/milo-dashboard-logo.png', { file: 'milo_dashboard_white_transparent_smooth.png', type: 'image/png' }],
    ['/assets/milo-dashboard-logo-126.webp', { file: 'milo_dashboard_white_transparent_smooth_126.webp', type: 'image/webp' }],
    ['/assets/milo-dashboard-logo-252.webp', { file: 'milo_dashboard_white_transparent_smooth_252.webp', type: 'image/webp' }],
  ]);
  const assetCache = new Map<string, Buffer>();

  function setSessionCookie(reply: { header: (name: string, value: string | string[]) => void }, user: AuthUser) {
    const token = createSignedToken(user, auth.sessionSecret);
    reply.header(
      'set-cookie',
      serializeCookie(getSessionCookieName(), token, {
        maxAge: 60 * 60 * 24 * 14,
        sameSite: 'Lax',
        secure: auth.secureCookies,
      }),
    );
  }

  async function syncCronJobsIntoStore() {
    try {
      const jobs = await cronJobsService.listJobs();
      await store.syncJobs(jobs);
    } catch (error) {
      app.log.error({ error }, 'failed to sync cron jobs into dashboard store');
    }
  }

  function getCronSourceIdFromKey(key: string) {
    return key.startsWith('cron:') ? key.slice('cron:'.length) : null;
  }

  function isLoopbackIp(ip: string | undefined) {
    if (!ip) return false;
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  }

  function isAuthorizedInternalIngest(request: { ip?: string; headers: Record<string, string | string[] | undefined> }) {
    if (isLoopbackIp(request.ip)) return true;
    if (!internalIngestToken) return false;
    const token = request.headers['x-milo-dashboard-ingest-token'];
    return typeof token === 'string' && token === internalIngestToken;
  }

  app.addHook('onReady', async () => {
    await syncCronJobsIntoStore();
  });

  function clearSessionCookie(reply: { header: (name: string, value: string | string[]) => void }) {
    reply.header(
      'set-cookie',
      serializeCookie(getSessionCookieName(), '', {
        maxAge: 0,
        sameSite: 'Lax',
        secure: auth.secureCookies,
      }),
    );
  }

  function setOauthStateCookie(reply: { header: (name: string, value: string | string[]) => void }, state: string) {
    reply.header(
      'set-cookie',
      serializeCookie(getOauthStateCookieName(), state, {
        maxAge: 60 * 10,
        sameSite: 'Lax',
        secure: auth.secureCookies,
      }),
    );
  }

  function clearOauthStateCookie(reply: { header: (name: string, value: string | string[]) => void }) {
    reply.header(
      'set-cookie',
      serializeCookie(getOauthStateCookieName(), '', {
        maxAge: 0,
        sameSite: 'Lax',
        secure: auth.secureCookies,
      }),
    );
  }

  async function ensurePageUser(request: { headers: { cookie?: string } }, reply: { redirect: (location: string) => unknown }) {
    const user = auth.sessionSecret ? getRequestUser(request.headers.cookie, auth.sessionSecret) : null;
    if (!user) {
      await reply.redirect('/login');
      return undefined;
    }
    return user;
  }

  async function ensureApiUser(
    request: { headers: { cookie?: string } },
    reply: { status: (code: number) => { send: (payload: unknown) => unknown } },
  ) {
    const user = auth.sessionSecret ? getRequestUser(request.headers.cookie, auth.sessionSecret) : null;
    if (!user) {
      reply.status(401).send({ error: 'unauthorized' });
      return undefined;
    }
    return user;
  }

  for (const [route, asset] of assetFiles.entries()) {
    app.get(route, async (_request, reply) => {
      try {
        let file = assetCache.get(route);
        if (!file) {
          file = await readFile(path.join(assetsDir, asset.file));
          assetCache.set(route, file);
        }
        reply.header('Cache-Control', 'public, max-age=31536000, immutable');
        return reply.type(asset.type).send(file);
      } catch (error) {
        app.log.error({ error, route }, 'failed to read logo asset');
        return reply.status(404).send({ error: 'asset_not_found' });
      }
    });
  }

  app.get('/', async (request, reply) => {
    const user = await ensurePageUser(request, reply);
    if (user === undefined) return reply;

    const summary = await store.getDashboardSummary();
    return reply.type('text/html; charset=utf-8').send(renderDashboardPage(summary, user));
  });

  app.get('/login', async (request, reply) => {
    const currentUser = auth.enabled ? getRequestUser(request.headers.cookie, auth.sessionSecret) : null;
    if (currentUser) return reply.redirect('/');

    const query = request.query as { error?: string };
    return reply.type('text/html; charset=utf-8').send(renderLoginPage({ authEnabled: auth.enabled, error: query?.error }));
  });

  app.get('/chat', async (request, reply) => {
    const user = await ensurePageUser(request, reply);
    if (user === undefined) return reply;
    if (!CHAT_ENABLED) return reply.redirect('/?chat=disabled');

    const query = request.query as { prefill?: string };
    return reply.type('text/html; charset=utf-8').send(renderChatPage(user, { prefill: query.prefill ?? '' }));
  });

  app.get('/auth/discord/login', async (_request, reply) => {
    if (!auth.enabled) return reply.redirect('/login?error=oauth_failed');

    const state = createOauthState();
    setOauthStateCookie(reply, state);
    return reply.redirect(buildDiscordOauthUrl(auth, state));
  });

  app.get('/auth/discord/callback', async (request, reply) => {
    if (!auth.enabled) return reply.redirect('/login?error=oauth_failed');

    const query = request.query as { code?: string; state?: string };
    const cookies = parseCookieHeader(request.headers.cookie);
    const cookieState = cookies[getOauthStateCookieName()];

    if (!query.state || !cookieState || query.state !== cookieState || !query.code) {
      clearOauthStateCookie(reply);
      return reply.redirect('/login?error=invalid_state');
    }

    try {
      const token = await exchangeDiscordCode(auth, query.code);
      const discordUser = await fetchDiscordUser(token.access_token);
      const user = toAuthUser(auth, discordUser);

      clearOauthStateCookie(reply);
      if (!user) {
        clearSessionCookie(reply);
        return reply.redirect('/login?error=not_allowed');
      }

      setSessionCookie(reply, user);
      return reply.redirect('/');
    } catch (error) {
      app.log.error({ error }, 'discord oauth failed');
      clearOauthStateCookie(reply);
      clearSessionCookie(reply);
      return reply.redirect('/login?error=oauth_failed');
    }
  });

  app.get('/auth/logout', async (_request, reply) => {
    clearSessionCookie(reply);
    clearOauthStateCookie(reply);
    return reply.redirect('/login');
  });

  app.get('/api', async () => ({
    service: 'milo-dashboard',
    status: 'ok',
    auth: { discordOauthEnabled: auth.enabled, roles: ['admin', 'developer'] },
    endpoints: ['/', '/login', '/auth/discord/login', '/api/dashboard', '/api/me'],
  }));

  app.get('/api/me', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;
    return { data: { user, authEnabled: auth.enabled } };
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (_request, reply) => {
    try {
      await dbHealthcheck();
      return { status: 'ready' };
    } catch (error) {
      app.log.error({ error }, 'readiness check failed');
      return reply.status(503).send({ status: 'not_ready' });
    }
  });

  app.get('/api/dashboard', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const summary = await store.getDashboardSummary();
    return { data: summary };
  });

  app.get('/api/jobs', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const jobs = await store.listJobs();
    return { data: jobs };
  });

  app.post('/api/jobs/sync', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    await syncCronJobsIntoStore();
    const jobs = await store.listJobs();
    return { data: jobs };
  });

  app.post('/api/jobs/run', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const parsed = runJobBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    const sourceId = getCronSourceIdFromKey(parsed.data.key);
    if (!sourceId) return reply.status(400).send({ error: 'job_not_runnable' });

    try {
      const result = await cronJobsService.runJob(sourceId);
      await syncCronJobsIntoStore();
      return { data: result };
    } catch (error) {
      app.log.error({ error, key: parsed.data.key, userId: user.id }, 'manual cron job run failed');
      return reply.status(502).send({ error: 'job_run_failed' });
    }
  });

  app.post('/api/jobs', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const parsed = createJobSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    try {
      const job = await store.createJob(parsed.data);
      return reply.status(201).send({ data: job });
    } catch (error) {
      app.log.error({ error }, 'failed to create job');
      return reply.status(500).send({ error: 'failed_to_create_job' });
    }
  });

  app.get('/api/job-runs', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const parsed = limitQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });

    const runs = await store.listJobRuns(parsed.data.limit);
    return { data: runs };
  });

  app.post('/api/job-runs', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const parsed = createJobRunSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    try {
      const run = await store.createJobRun(parsed.data);
      return reply.status(201).send({ data: run });
    } catch (error) {
      app.log.error({ error }, 'failed to create job run');
      const message = error instanceof Error ? error.message : 'unknown_error';
      const statusCode = message.includes('Job not found') ? 404 : 500;
      return reply.status(statusCode).send({ error: 'failed_to_create_job_run', message });
    }
  });

  app.get('/api/ticket-runs', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const parsed = limitQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });

    const runs = await store.listTicketRuns(parsed.data.limit);
    return { data: runs };
  });

  app.post('/api/internal/ticket-runs', async (request, reply) => {
    if (!isAuthorizedInternalIngest(request)) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const parsed = createTicketRunSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    try {
      const run = await store.createTicketRun(parsed.data as CreateTicketRunInput);
      return reply.status(201).send({ data: run });
    } catch (error) {
      app.log.error({ error }, 'failed to create internal ticket run');
      return reply.status(500).send({ error: 'failed_to_create_ticket_run' });
    }
  });

  app.get('/api/jobs/activity', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const parsed = jobActivityQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });

    await syncCronJobsIntoStore();
    const jobs = await store.listJobs();
    const job = jobs.find((item) => item.key === parsed.data.key);
    if (!job) return reply.status(404).send({ error: 'job_not_found' });

    const sourceId = getCronSourceIdFromKey(job.key);
    const [liveRuns, ticketRuns] = await Promise.all([
      sourceId ? cronJobsService.listRuns(sourceId, 12) : Promise.resolve([]),
      store.listTicketRunsForJob(job.key, job.name, 20),
    ]);

    return { data: { job, liveRuns, ticketRuns } };
  });

  app.get('/api/ticket-runs/activity', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const parsed = z.object({ jiraKey: z.string().min(1) }).safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });

    const ticketRuns = await store.listTicketRunsByJiraKey(parsed.data.jiraKey, 20);
    const jobRunIds = [...new Set(ticketRuns.map((item) => item.jobRunId).filter((value): value is string => Boolean(value)))];
    const jobRuns = await store.listJobRunsByIds(jobRunIds);
    return { data: { jiraKey: parsed.data.jiraKey, ticketRuns, jobRuns } };
  });

  app.get('/api/chat/history', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;
    if (!CHAT_ENABLED) return reply.status(503).send({ error: 'chat_disabled' });

    const parsed = chatHistoryQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });

    const sessionKey = buildSessionId(user.id, parsed.data.conversationId);
    const messages = await store.listChatMessages(sessionKey, 100);
    return { data: { messages } };
  });

  app.get('/api/chat/bootstrap', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;
    if (!CHAT_ENABLED) return reply.status(503).send({ error: 'chat_disabled' });

    const parsed = chatHistoryQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });

    const sessionKey = buildSessionId(user.id, parsed.data.conversationId);
    const [sessions, messages] = await Promise.all([
      store.listChatSessions(user.id, 100),
      store.listChatMessages(sessionKey, 100),
    ]);

    return { data: { sessions, messages } };
  });

  app.get('/api/chat/sessions', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;
    if (!CHAT_ENABLED) return reply.status(503).send({ error: 'chat_disabled' });

    const sessions = await store.listChatSessions(user.id, 100);
    return { data: { sessions } };
  });

  app.patch('/api/chat/sessions/:conversationId', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;
    if (!CHAT_ENABLED) return reply.status(503).send({ error: 'chat_disabled' });

    const params = z.object({ conversationId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/) }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: 'invalid_params', details: params.error.flatten() });

    const parsed = renameChatSessionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    const session = await store.renameChatSession({
      sessionKey: buildSessionId(user.id, params.data.conversationId),
      userId: user.id,
      title: parsed.data.title,
    });

    if (!session) return reply.status(404).send({ error: 'not_found' });
    return { data: { session } };
  });

  app.delete('/api/chat/sessions/:conversationId', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;
    if (!CHAT_ENABLED) return reply.status(503).send({ error: 'chat_disabled' });

    const params = z.object({ conversationId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/) }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: 'invalid_params', details: params.error.flatten() });

    const deleted = await store.deleteChatSession({
      sessionKey: buildSessionId(user.id, params.data.conversationId),
      userId: user.id,
    });

    if (!deleted) return reply.status(404).send({ error: 'not_found' });
    return { data: { deleted: true } };
  });

  app.post('/api/chat', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;
    if (!CHAT_ENABLED) return reply.status(503).send({ error: 'chat_disabled' });

    const parsed = chatBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    const sessionKey = buildSessionId(user.id, parsed.data.conversationId);

    try {
      await store.createChatMessage({
        sessionKey,
        userId: user.id,
        role: 'user',
        content: parsed.data.message,
      });

      const result = await chatService.sendMessage({ user, message: parsed.data.message, conversationId: parsed.data.conversationId });

      await store.createChatMessage({
        sessionKey,
        userId: user.id,
        role: 'assistant',
        content: result.reply,
        meta: result.meta,
      });

      return { data: result };
    } catch (error) {
      app.log.error({ error, userId: user.id }, 'chat service failed');
      return reply.status(502).send({ error: 'chat_backend_failed' });
    }
  });

  return app;
}
