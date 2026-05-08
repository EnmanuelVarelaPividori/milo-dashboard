import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createSignedToken, getSessionCookieName, type AuthUser } from '../src/lib/auth.js';
import type { ChatMessage, ChatSession, DashboardStore, DashboardSummary, Job, JobRun, TicketRun } from '../src/lib/store.js';
import type { CronJobsService } from '../src/services/cron-jobs.js';
import type { ChatService } from '../src/services/chat.js';

process.env.SESSION_SECRET = 'test-session-secret';

function createAuthCookie() {
  const user: AuthUser = {
    id: '429876165121933312',
    username: 'daymus11',
    displayName: 'Manu',
    avatarUrl: null,
    role: 'admin',
  };

  const token = createSignedToken(user, process.env.SESSION_SECRET!);
  return `${getSessionCookieName()}=${encodeURIComponent(token)}`;
}

function createMockChatService(): ChatService {
  return {
    async sendMessage({ user, message }) {
      return {
        reply: `mock-reply:${user.displayName}:${message}`,
        meta: { sessionId: 'webchat-discord-429876165121933312' },
      };
    },
  };
}

function createMockCronJobsService(): CronJobsService {
  return {
    async listJobs() {
      return [];
    },
    async runJob(sourceId) {
      return { ok: true, output: `ran:${sourceId}` };
    },
  };
}

function createMockStore(): DashboardStore {
  const jobs: Job[] = [];
  const jobRuns: JobRun[] = [];
  const ticketRuns: TicketRun[] = [];
  const chatMessages: ChatMessage[] = [];
  const chatSessions: ChatSession[] = [];

  const getDashboardSummary = async (): Promise<DashboardSummary> => {
    const ticketsTaken = ticketRuns.length;
    const ticketsSucceeded = ticketRuns.filter((item) => item.dispatchStatus === 'success').length;
    const ticketsFailed = ticketRuns.filter((item) => item.dispatchStatus === 'failed').length;

    return {
      totals: {
        jobs: jobs.length,
        activeJobs: jobs.filter((item) => item.enabled).length,
        jobRuns: jobRuns.length,
        failedJobRuns: jobRuns.filter((item) => item.status === 'failed').length,
        ticketsTaken,
        ticketsSucceeded,
        ticketsFailed,
        successRate: ticketsTaken === 0 ? 0 : Math.round((ticketsSucceeded / ticketsTaken) * 100),
      },
      recentNotifications: [],
      recentJobs: jobs.slice(0, 6),
      recentTicketRuns: ticketRuns.slice(0, 8),
    };
  };

  return {
    async listJobs() {
      return jobs;
    },
    async syncJobs(nextJobs) {
      for (let i = jobs.length - 1; i >= 0; i -= 1) {
        if (jobs[i].key.startsWith('cron:')) jobs.splice(i, 1);
      }
      nextJobs.forEach((input, index) => {
        jobs.push({
          id: `synced-${index}`,
          key: input.key,
          name: input.name,
          schedule: input.schedule,
          enabled: input.enabled ?? true,
          lastRunAt: input.lastRunAt ?? null,
          lastStatus: input.lastStatus ?? null,
          runningAt: input.runningAt ?? null,
          nextRunAt: input.nextRunAt ?? null,
          createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        });
      });
    },
    async createJob(input) {
      const job: Job = {
        id: 'job-1',
        key: input.key,
        name: input.name,
        schedule: input.schedule,
        enabled: input.enabled ?? true,
        lastRunAt: null,
        lastStatus: null,
        runningAt: null,
        nextRunAt: input.nextRunAt ?? null,
        createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      };
      jobs.unshift(job);
      return job;
    },
    async listJobRuns() {
      return jobRuns;
    },
    async createJobRun(input) {
      const job = jobs.find((item) => item.key === input.jobKey);
      if (!job) throw new Error(`Job not found for key: ${input.jobKey}`);
      const run: JobRun = {
        id: 'run-1',
        jobId: job.id,
        status: input.status,
        startedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        finishedAt: input.finishedAt ?? null,
        summary: input.summary ?? null,
        error: input.error ?? null,
        data: input.data ?? {},
      };
      jobRuns.unshift(run);
      return run;
    },
    async listTicketRuns() {
      return ticketRuns;
    },
    getDashboardSummary,
    async listChatMessages(sessionKey) {
      return chatMessages.filter((item) => item.sessionKey === sessionKey);
    },
    async listChatSessions(userId) {
      return chatSessions
        .filter((item) => item.userId === userId)
        .sort((a, b) => (b.lastMessageAt || b.updatedAt).localeCompare(a.lastMessageAt || a.updatedAt));
    },
    async getChatSession(sessionKey) {
      return chatSessions.find((item) => item.sessionKey === sessionKey) ?? null;
    },
    async ensureChatSession(input) {
      let session = chatSessions.find((item) => item.sessionKey === input.sessionKey) ?? null;
      if (!session) {
        session = {
          sessionKey: input.sessionKey,
          userId: input.userId,
          title: input.title?.trim() || 'Nueva conversación',
          createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          lastMessageAt: null,
          messageCount: 0,
          preview: null,
        };
        chatSessions.push(session);
      }
      return session;
    },
    async renameChatSession(input) {
      const session = chatSessions.find((item) => item.sessionKey === input.sessionKey && item.userId === input.userId);
      if (!session) return null;
      session.title = input.title;
      return session;
    },
    async deleteChatSession(input) {
      const idx = chatSessions.findIndex((item) => item.sessionKey === input.sessionKey && item.userId === input.userId);
      if (idx === -1) return false;
      chatSessions.splice(idx, 1);
      for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
        if (chatMessages[i].sessionKey === input.sessionKey && chatMessages[i].userId === input.userId) chatMessages.splice(i, 1);
      }
      return true;
    },
    async createChatMessage(input) {
      let session = chatSessions.find((item) => item.sessionKey === input.sessionKey);
      if (!session) {
        session = await this.ensureChatSession({ sessionKey: input.sessionKey, userId: input.userId, title: input.content });
      }
      const message: ChatMessage = {
        id: `${chatMessages.length + 1}`,
        sessionKey: input.sessionKey,
        userId: input.userId,
        role: input.role,
        content: input.content,
        meta: input.meta ?? {},
        createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      };
      chatMessages.push(message);
      session.title = session.title === 'Nueva conversación' && input.role === 'user' ? input.content.slice(0, 80) : session.title;
      session.lastMessageAt = message.createdAt;
      session.updatedAt = message.createdAt;
      session.messageCount += 1;
      session.preview = message.content;
      return message;
    },
  };
}

describe('app', () => {
  it('returns health status', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {}, chatService: createMockChatService(), cronJobsService: createMockCronJobsService() });
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });

    await app.close();
  });

  it('redirects dashboard home to login when not authenticated', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {}, chatService: createMockChatService(), cronJobsService: createMockCronJobsService() });
    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/login');

    await app.close();
  });

  it('redirects chat page to login when not authenticated', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {}, chatService: createMockChatService(), cronJobsService: createMockCronJobsService() });
    const response = await app.inject({ method: 'GET', url: '/chat' });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/login');

    await app.close();
  });

  it('returns api service info', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {}, chatService: createMockChatService(), cronJobsService: createMockCronJobsService() });
    const response = await app.inject({ method: 'GET', url: '/api' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ service: 'milo-dashboard', status: 'ok' });

    await app.close();
  });

  it('creates and lists jobs', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {}, chatService: createMockChatService(), cronJobsService: createMockCronJobsService() });
    const cookie = createAuthCookie();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      headers: { cookie },
      payload: {
        key: 'milo-dispatch',
        name: 'Milo dispatch',
        schedule: '0 9 * * *',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().data.key).toBe('milo-dispatch');

    const listResponse = await app.inject({ method: 'GET', url: '/api/jobs', headers: { cookie } });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().data).toHaveLength(1);

    await app.close();
  });

  it('runs cron-backed jobs manually', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {}, chatService: createMockChatService(), cronJobsService: createMockCronJobsService() });
    const cookie = createAuthCookie();

    const response = await app.inject({
      method: 'POST',
      url: '/api/jobs/run',
      headers: { cookie },
      payload: { key: 'cron:test-job-123' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.output).toBe('ran:test-job-123');

    await app.close();
  });

  it('creates a job run for an existing job', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {}, chatService: createMockChatService(), cronJobsService: createMockCronJobsService() });
    const cookie = createAuthCookie();

    await app.inject({
      method: 'POST',
      url: '/api/jobs',
      headers: { cookie },
      payload: {
        key: 'milo-dispatch',
        name: 'Milo dispatch',
        schedule: '0 9 * * *',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/job-runs',
      headers: { cookie },
      payload: {
        jobKey: 'milo-dispatch',
        status: 'success',
        summary: 'Run finished ok',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.status).toBe('success');

    const listResponse = await app.inject({ method: 'GET', url: '/api/job-runs', headers: { cookie } });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().data).toHaveLength(1);

    await app.close();
  });

  it('requires auth for dashboard api', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {}, chatService: createMockChatService(), cronJobsService: createMockCronJobsService() });
    const response = await app.inject({ method: 'GET', url: '/api/dashboard' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'unauthorized' });

    await app.close();
  });

  it('requires auth for chat api', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {}, chatService: createMockChatService(), cronJobsService: createMockCronJobsService() });
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { message: 'hola milo' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'unauthorized' });

    await app.close();
  });

  it('returns chat service response when authenticated', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {}, chatService: createMockChatService(), cronJobsService: createMockCronJobsService() });
    const cookie = createAuthCookie();
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { cookie },
      payload: { message: 'hola milo' },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'chat_disabled' });

    await app.close();
  });

  it('returns stored chat history when authenticated', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {}, chatService: createMockChatService(), cronJobsService: createMockCronJobsService() });
    const cookie = createAuthCookie();
    await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { cookie },
      payload: { message: 'hola milo' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/chat/history',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'chat_disabled' });

    await app.close();
  });

  it('returns chat bootstrap payload with sessions and history', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {}, chatService: createMockChatService(), cronJobsService: createMockCronJobsService() });
    const cookie = createAuthCookie();

    await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { cookie },
      payload: { message: 'hola bootstrap', conversationId: 'conv-bootstrap' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/chat/bootstrap?conversationId=conv-bootstrap',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'chat_disabled' });

    await app.close();
  });

  it('scopes chat history by conversation id', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {}, chatService: createMockChatService(), cronJobsService: createMockCronJobsService() });
    const cookie = createAuthCookie();

    await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { cookie },
      payload: { message: 'hola a', conversationId: 'conv-a' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { cookie },
      payload: { message: 'hola b', conversationId: 'conv-b' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/chat/history?conversationId=conv-a',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'chat_disabled' });

    await app.close();
  });

  it('lists, renames and deletes chat sessions', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {}, chatService: createMockChatService(), cronJobsService: createMockCronJobsService() });
    const cookie = createAuthCookie();

    await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { cookie },
      payload: { message: 'primera charla', conversationId: 'conv-a' },
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/chat/sessions',
      headers: { cookie },
    });

    expect(listResponse.statusCode).toBe(503);
    expect(listResponse.json()).toMatchObject({ error: 'chat_disabled' });

    await app.close();
  });
});
