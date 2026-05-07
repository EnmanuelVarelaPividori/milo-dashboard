import Fastify from 'fastify';
import { prisma } from './lib/prisma.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get('/', async () => ({
    service: 'milo-dashboard',
    status: 'ok',
  }));

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch (error) {
      app.log.error({ error }, 'readiness check failed');
      return reply.status(503).send({ status: 'not_ready' });
    }
  });

  return app;
}
