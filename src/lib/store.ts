import { randomUUID } from 'node:crypto';
import { pool } from './db.js';

export type Job = {
  id: string;
  key: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobRun = {
  id: string;
  jobId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  summary: string | null;
  error: string | null;
  data: Record<string, unknown>;
};

export type TicketRun = {
  id: string;
  jobRunId: string | null;
  jiraKey: string;
  jiraSummary: string | null;
  jiraStatus: string | null;
  dispatchStatus: string;
  score: number | null;
  branchName: string | null;
  prUrl: string | null;
  note: string | null;
  testSummary: string | null;
  startedAt: string;
  finishedAt: string | null;
  data: Record<string, unknown>;
};

export type DashboardNotification = {
  id: string;
  type: 'job_run' | 'ticket_run';
  title: string;
  detail: string;
  severity: 'error' | 'warning';
  occurredAt: string;
};

export type DashboardSummary = {
  totals: {
    jobs: number;
    activeJobs: number;
    jobRuns: number;
    failedJobRuns: number;
    ticketsTaken: number;
    ticketsSucceeded: number;
    ticketsFailed: number;
    successRate: number;
  };
  recentNotifications: DashboardNotification[];
  recentJobs: Job[];
  recentTicketRuns: TicketRun[];
};

export type CreateJobInput = {
  key: string;
  name: string;
  schedule: string;
  enabled?: boolean;
  nextRunAt?: string | null;
};

export type CreateJobRunInput = {
  jobKey: string;
  status: string;
  summary?: string;
  error?: string;
  data?: Record<string, unknown>;
  finishedAt?: string | null;
};

export type DashboardStore = {
  listJobs(): Promise<Job[]>;
  createJob(input: CreateJobInput): Promise<Job>;
  listJobRuns(limit?: number): Promise<JobRun[]>;
  createJobRun(input: CreateJobRunInput): Promise<JobRun>;
  listTicketRuns(limit?: number): Promise<TicketRun[]>;
  getDashboardSummary(): Promise<DashboardSummary>;
};

function mapJob(row: Record<string, unknown>): Job {
  return {
    id: String(row.id),
    key: String(row.key),
    name: String(row.name),
    schedule: String(row.schedule),
    enabled: Boolean(row.enabled),
    lastRunAt: row.last_run_at ? new Date(String(row.last_run_at)).toISOString() : null,
    nextRunAt: row.next_run_at ? new Date(String(row.next_run_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapJobRun(row: Record<string, unknown>): JobRun {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    status: String(row.status),
    startedAt: new Date(String(row.started_at)).toISOString(),
    finishedAt: row.finished_at ? new Date(String(row.finished_at)).toISOString() : null,
    summary: row.summary ? String(row.summary) : null,
    error: row.error ? String(row.error) : null,
    data: (row.data as Record<string, unknown> | null) ?? {},
  };
}

function mapTicketRun(row: Record<string, unknown>): TicketRun {
  return {
    id: String(row.id),
    jobRunId: row.job_run_id ? String(row.job_run_id) : null,
    jiraKey: String(row.jira_key),
    jiraSummary: row.jira_summary ? String(row.jira_summary) : null,
    jiraStatus: row.jira_status ? String(row.jira_status) : null,
    dispatchStatus: String(row.dispatch_status),
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    branchName: row.branch_name ? String(row.branch_name) : null,
    prUrl: row.pr_url ? String(row.pr_url) : null,
    note: row.note ? String(row.note) : null,
    testSummary: row.test_summary ? String(row.test_summary) : null,
    startedAt: new Date(String(row.started_at)).toISOString(),
    finishedAt: row.finished_at ? new Date(String(row.finished_at)).toISOString() : null,
    data: (row.data as Record<string, unknown> | null) ?? {},
  };
}

function mapNotification(row: Record<string, unknown>): DashboardNotification {
  return {
    id: String(row.id),
    type: String(row.type) === 'ticket_run' ? 'ticket_run' : 'job_run',
    title: String(row.title),
    detail: String(row.detail),
    severity: String(row.severity) === 'warning' ? 'warning' : 'error',
    occurredAt: new Date(String(row.occurred_at)).toISOString(),
  };
}

export function createPostgresStore(): DashboardStore {
  return {
    async listJobs() {
      const result = await pool.query('SELECT * FROM jobs ORDER BY created_at DESC');
      return result.rows.map((row) => mapJob(row));
    },

    async createJob(input) {
      const id = randomUUID();
      const enabled = input.enabled ?? true;
      const result = await pool.query(
        `INSERT INTO jobs (id, key, name, schedule, enabled, next_run_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, input.key, input.name, input.schedule, enabled, input.nextRunAt ?? null],
      );
      return mapJob(result.rows[0]);
    },

    async listJobRuns(limit = 20) {
      const result = await pool.query('SELECT * FROM job_runs ORDER BY started_at DESC LIMIT $1', [limit]);
      return result.rows.map((row) => mapJobRun(row));
    },

    async createJobRun(input) {
      const jobResult = await pool.query('SELECT id FROM jobs WHERE key = $1 LIMIT 1', [input.jobKey]);
      if (jobResult.rowCount === 0) {
        throw new Error(`Job not found for key: ${input.jobKey}`);
      }

      const jobId = String(jobResult.rows[0].id);
      const id = randomUUID();
      const result = await pool.query(
        `INSERT INTO job_runs (id, job_id, status, summary, error, data, finished_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, jobId, input.status, input.summary ?? null, input.error ?? null, input.data ?? {}, input.finishedAt ?? null],
      );

      await pool.query(
        `UPDATE jobs
         SET last_run_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [jobId],
      );

      return mapJobRun(result.rows[0]);
    },

    async listTicketRuns(limit = 20) {
      const result = await pool.query('SELECT * FROM ticket_runs ORDER BY started_at DESC LIMIT $1', [limit]);
      return result.rows.map((row) => mapTicketRun(row));
    },

    async getDashboardSummary() {
      const [totalsResult, notificationsResult, jobsResult, ticketRunsResult] = await Promise.all([
        pool.query(`
          SELECT
            (SELECT COUNT(*)::int FROM jobs) AS jobs,
            (SELECT COUNT(*)::int FROM jobs WHERE enabled = TRUE) AS active_jobs,
            (SELECT COUNT(*)::int FROM job_runs) AS job_runs,
            (SELECT COUNT(*)::int FROM job_runs WHERE lower(status) IN ('failed', 'error', 'errored', 'cancelled')) AS failed_job_runs,
            (SELECT COUNT(*)::int FROM ticket_runs) AS tickets_taken,
            (SELECT COUNT(*)::int FROM ticket_runs WHERE lower(dispatch_status) IN ('success', 'ok', 'completed', 'done', 'passed')) AS tickets_succeeded,
            (SELECT COUNT(*)::int FROM ticket_runs WHERE lower(dispatch_status) IN ('failed', 'error', 'errored', 'cancelled', 'rejected')) AS tickets_failed
        `),
        pool.query(`
          SELECT *
          FROM (
            SELECT
              jr.id,
              'job_run'::text AS type,
              COALESCE(j.name, 'Job sin nombre') AS title,
              COALESCE(jr.error, jr.summary, 'La corrida terminó con error') AS detail,
              'error'::text AS severity,
              COALESCE(jr.finished_at, jr.started_at) AS occurred_at
            FROM job_runs jr
            JOIN jobs j ON j.id = jr.job_id
            WHERE lower(jr.status) IN ('failed', 'error', 'errored', 'cancelled')
               OR jr.error IS NOT NULL

            UNION ALL

            SELECT
              tr.id,
              'ticket_run'::text AS type,
              tr.jira_key AS title,
              COALESCE(tr.note, tr.test_summary, tr.jira_summary, 'El ticket necesita revisión') AS detail,
              CASE WHEN lower(tr.dispatch_status) IN ('cancelled', 'rejected') THEN 'warning'::text ELSE 'error'::text END AS severity,
              COALESCE(tr.finished_at, tr.started_at) AS occurred_at
            FROM ticket_runs tr
            WHERE lower(tr.dispatch_status) IN ('failed', 'error', 'errored', 'cancelled', 'rejected')
          ) notifications
          ORDER BY occurred_at DESC
          LIMIT 8
        `),
        pool.query('SELECT * FROM jobs ORDER BY updated_at DESC, created_at DESC LIMIT 6'),
        pool.query('SELECT * FROM ticket_runs ORDER BY started_at DESC LIMIT 8'),
      ]);

      const totalsRow = totalsResult.rows[0] as Record<string, unknown>;
      const ticketsTaken = Number(totalsRow.tickets_taken ?? 0);
      const ticketsSucceeded = Number(totalsRow.tickets_succeeded ?? 0);
      const ticketsFailed = Number(totalsRow.tickets_failed ?? 0);
      const successRate = ticketsTaken === 0 ? 0 : Math.round((ticketsSucceeded / ticketsTaken) * 100);

      return {
        totals: {
          jobs: Number(totalsRow.jobs ?? 0),
          activeJobs: Number(totalsRow.active_jobs ?? 0),
          jobRuns: Number(totalsRow.job_runs ?? 0),
          failedJobRuns: Number(totalsRow.failed_job_runs ?? 0),
          ticketsTaken,
          ticketsSucceeded,
          ticketsFailed,
          successRate,
        },
        recentNotifications: notificationsResult.rows.map((row) => mapNotification(row)),
        recentJobs: jobsResult.rows.map((row) => mapJob(row)),
        recentTicketRuns: ticketRunsResult.rows.map((row) => mapTicketRun(row)),
      };
    },
  };
}
