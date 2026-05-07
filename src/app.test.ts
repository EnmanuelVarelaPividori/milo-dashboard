import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { DashboardStore, Job, JobRun, TicketRun } from './lib/store.js';

function createMockStore(): DashboardStore {
  const jobs: Job[] = [];
  const jobRuns: JobRun[] = [];
  const ticketRuns: TicketRun[] = [];

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

  it('returns service info', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {} });
    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ service: 'milo-dashboard', status: 'ok' });

    await app.close();
  });

  it('creates and lists jobs', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {} });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: {
        key: 'milo-dispatch',
        name: 'Milo dispatch',
        schedule: '0 9 * * *',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().data.key).toBe('milo-dispatch');

    const listResponse = await app.inject({ method: 'GET', url: '/api/jobs' });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().data).toHaveLength(1);

    await app.close();
  });

  it('creates a job run for an existing job', async () => {
    const app = buildApp({ store: createMockStore(), dbHealthcheck: async () => {} });

    await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: {
        key: 'milo-dispatch',
        name: 'Milo dispatch',
        schedule: '0 9 * * *',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/job-runs',
      payload: {
        jobKey: 'milo-dispatch',
        status: 'success',
        summary: 'Run finished ok',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.status).toBe('success');

    const listResponse = await app.inject({ method: 'GET', url: '/api/job-runs' });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().data).toHaveLength(1);

    await app.close();
  });
});
