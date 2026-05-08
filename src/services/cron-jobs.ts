import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type SyncedJob = {
  sourceId: string | null;
  key: string;
  name: string;
  schedule: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  runningAt: string | null;
};

export type CronJobsService = {
  listJobs(): Promise<SyncedJob[]>;
  runJob(sourceId: string): Promise<{ ok: boolean; output: string }>;
  listRuns(sourceId: string, limit?: number): Promise<CronRun[]>;
};

export type CronRun = {
  status: string;
  summary: string | null;
  error: string | null;
  runAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  delivered: boolean | null;
  sessionKey: string | null;
};

type CronListResponse = {
  jobs?: Array<{
    id?: string;
    name?: string;
    enabled?: boolean;
    schedule?: { kind?: string; expr?: string; everyMs?: number; at?: string; tz?: string };
    state?: { nextRunAtMs?: number; lastRunAtMs?: number; lastRunStatus?: string; lastStatus?: string; runningAtMs?: number };
  }>;
};

type CronRunsResponse = {
  entries?: Array<{
    status?: string;
    summary?: string;
    error?: string;
    runAtMs?: number;
    ts?: number;
    durationMs?: number;
    delivered?: boolean;
    sessionKey?: string;
  }>;
};

type CronJobRecord = NonNullable<CronListResponse['jobs']>[number];

function formatSchedule(schedule: CronJobRecord['schedule']) {
  if (!schedule?.kind) return 'unknown';
  if (schedule.kind === 'cron') return schedule.tz ? `${schedule.expr} (${schedule.tz})` : String(schedule.expr ?? 'cron');
  if (schedule.kind === 'every') return `every ${schedule.everyMs ?? 0}ms`;
  if (schedule.kind === 'at') return String(schedule.at ?? 'one-shot');
  return schedule.kind;
}

export function createCronJobsService(): CronJobsService {
  return {
    async listJobs() {
      const { stdout } = await execFileAsync('openclaw', ['cron', 'list', '--all', '--json'], {
        cwd: '/home/manu/.openclaw/workspace-milo',
        timeout: 30_000,
        maxBuffer: 10 * 1024 * 1024,
        env: process.env,
      });

      const payload = JSON.parse(stdout) as CronListResponse;
      return (payload.jobs ?? []).map((job) => ({
        sourceId: job.id ?? null,
        key: `cron:${job.id ?? job.name ?? 'unknown'}`,
        name: job.name ?? job.id ?? 'Unnamed cron job',
        schedule: formatSchedule(job.schedule),
        enabled: Boolean(job.enabled),
        nextRunAt: job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs).toISOString() : null,
        lastRunAt: job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs).toISOString() : null,
        lastStatus: job.state?.lastRunStatus ?? job.state?.lastStatus ?? null,
        runningAt: job.state?.runningAtMs ? new Date(job.state.runningAtMs).toISOString() : null,
      }));
    },

    async runJob(sourceId) {
      const { stdout, stderr } = await execFileAsync('openclaw', ['cron', 'run', sourceId, '--timeout', '10000'], {
        cwd: '/home/manu/.openclaw/workspace-milo',
        timeout: 20_000,
        maxBuffer: 10 * 1024 * 1024,
        env: process.env,
      });

      return {
        ok: true,
        output: [stdout, stderr].filter(Boolean).join('\n').trim() || 'run_started',
      };
    },

    async listRuns(sourceId, limit = 10) {
      const { stdout } = await execFileAsync('openclaw', ['cron', 'runs', sourceId, '--json'], {
        cwd: '/home/manu/.openclaw/workspace-milo',
        timeout: 30_000,
        maxBuffer: 10 * 1024 * 1024,
        env: process.env,
      });

      const payload = JSON.parse(stdout) as CronRunsResponse;
      return (payload.entries ?? []).slice(0, limit).map((entry) => ({
        status: entry.status ?? 'unknown',
        summary: entry.summary ?? null,
        error: entry.error ?? null,
        runAt: entry.runAtMs ? new Date(entry.runAtMs).toISOString() : null,
        finishedAt: entry.ts ? new Date(entry.ts).toISOString() : null,
        durationMs: entry.durationMs ?? null,
        delivered: typeof entry.delivered === 'boolean' ? entry.delivered : null,
        sessionKey: entry.sessionKey ?? null,
      }));
    },
  };
}
