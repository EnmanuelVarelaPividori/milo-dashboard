import Fastify from 'fastify';
import { z } from 'zod';
import { checkDbConnection } from './lib/db.js';
import { createPostgresStore, type DashboardStore } from './lib/store.js';

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

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: true });
  const store = options.store ?? createPostgresStore();
  const dbHealthcheck = options.dbHealthcheck ?? checkDbConnection;

  app.get('/', async () => ({
    service: 'milo-dashboard',
    status: 'ok',
    endpoints: ['/health', '/ready', '/api/jobs', '/api/job-runs', '/api/ticket-runs'],
  }));

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

  app.get('/api/jobs', async () => {
    const jobs = await store.listJobs();
    return { data: jobs };
  });

  app.post('/api/jobs', async (request, reply) => {
    const parsed = createJobSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }

    try {
      const job = await store.createJob(parsed.data);
      return reply.status(201).send({ data: job });
    } catch (error) {
      app.log.error({ error }, 'failed to create job');
      return reply.status(500).send({ error: 'failed_to_create_job' });
    }
  });

  app.get('/api/job-runs', async (request, reply) => {
    const parsed = limitQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    }

    const runs = await store.listJobRuns(parsed.data.limit);
    return { data: runs };
  });

  app.post('/api/job-runs', async (request, reply) => {
    const parsed = createJobRunSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }

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
    const parsed = limitQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    }

    const runs = await store.listTicketRuns(parsed.data.limit);
    return { data: runs };
  });

  return app;
}
