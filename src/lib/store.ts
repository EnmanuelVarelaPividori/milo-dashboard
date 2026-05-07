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
  };
}
