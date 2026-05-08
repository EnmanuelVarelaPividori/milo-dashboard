import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { createSignedToken, getSessionCookieName, type AuthUser } from './lib/auth.js';
import type { DashboardStore, DashboardSummary, Job, JobRun, TicketRun } from './lib/store.js';

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

function createMockStore(): DashboardStore {
  const jobs: Job[] = [];
  const jobRuns: JobRun[] = [];
  const ticketRuns: TicketRun[] = [];

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
    async createJob(input) {
      const job: Job = {
        id: 'job-1',
        key: input.key,
        name: input.name,
        schedule: input.schedule,
        enabled: input.enabled ?? true,
        lastRunAt: null,
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
  };
}

describe('app', () => {
  it('returns health status', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {} });
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });

    await app.close();
  });

  it('redirects dashboard home to login when not authenticated', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {} });
    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/login');

    await app.close();
  });

  it('redirects chat page to login when not authenticated', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {} });
    const response = await app.inject({ method: 'GET', url: '/chat' });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/login');

    await app.close();
  });

  it('returns api service info', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {} });
    const response = await app.inject({ method: 'GET', url: '/api' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ service: 'milo-dashboard', status: 'ok' });

    await app.close();
  });

  it('creates and lists jobs', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {} });

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

  it('creates a job run for an existing job', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {} });

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
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {} });
    const response = await app.inject({ method: 'GET', url: '/api/dashboard' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'unauthorized' });

    await app.close();
  });

  it('requires auth for chat api', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {} });
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { message: 'hola milo' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'unauthorized' });

    await app.close();
  });
});
