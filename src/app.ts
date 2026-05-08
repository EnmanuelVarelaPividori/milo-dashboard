import Fastify from 'fastify';
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
import { createPostgresStore, type DashboardStore } from './lib/store.js';
import { renderChatPage, renderDashboardPage, renderLoginPage } from './ui/pages.js';

type BuildAppOptions = {
  store?: DashboardStore;
  dbHealthcheck?: () => Promise<void>;
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

const limitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const chatBodySchema = z.object({
  message: z.string().min(1).max(4000),
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
  const auth = getDiscordAuthConfig();

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

    return reply.type('text/html; charset=utf-8').send(renderChatPage(user));
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
    endpoints: ['/', '/login', '/chat', '/auth/discord/login', '/api/dashboard', '/api/chat', '/api/me'],
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

  app.post('/api/chat', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const parsed = chatBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    const replyText = `Recibido, ${user.displayName}. Este chat web ya está protegido con Discord OAuth y tu rol es ${user.role}. Por ahora la respuesta es placeholder hasta conectarlo con Milo real. Tu mensaje fue: "${parsed.data.message}".`;
    return { data: { reply: replyText } };
  });

  return app;
}
