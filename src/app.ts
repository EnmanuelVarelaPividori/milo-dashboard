import Fastify from 'fastify';
import { checkDbConnection } from './lib/db.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get('/', async () => ({
    service: 'milo-dashboard',
    status: 'ok',
  }));

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (_request, reply) => {
    try {
      await checkDbConnection();
      return { status: 'ready' };
    } catch (error) {
      app.log.error({ error }, 'readiness check failed');
      return reply.status(503).send({ status: 'not_ready' });
    }
  });

  return app;
}
