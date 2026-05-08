import { randomUUID } from 'node:crypto';
import { pool } from './db.js';

export type Job = {
  id: string;
  key: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  runningAt: string | null;
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

export type ChatMessage = {
  id: string;
  sessionKey: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  meta: Record<string, unknown>;
  createdAt: string;
};

export type ChatSession = {
  sessionKey: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  messageCount: number;
  preview: string | null;
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

export type SyncJobInput = CreateJobInput & {
  lastRunAt?: string | null;
  lastStatus?: string | null;
  runningAt?: string | null;
};

export type CreateJobRunInput = {
  jobKey: string;
  status: string;
  summary?: string;
  error?: string;
  data?: Record<string, unknown>;
  finishedAt?: string | null;
};

export type CreateTicketRunInput = {
  jobRunId?: string | null;
  jiraKey: string;
  jiraSummary?: string | null;
  jiraStatus?: string | null;
  dispatchStatus: string;
  score?: number | null;
  branchName?: string | null;
  prUrl?: string | null;
  note?: string | null;
  testSummary?: string | null;
  finishedAt?: string | null;
  data?: Record<string, unknown>;
};

export type CreateChatMessageInput = {
  sessionKey: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  meta?: Record<string, unknown>;
};

export type DashboardStore = {
  listJobs(): Promise<Job[]>;
  syncJobs(jobs: SyncJobInput[]): Promise<void>;
  createJob(input: CreateJobInput): Promise<Job>;
  listJobRuns(limit?: number): Promise<JobRun[]>;
  createJobRun(input: CreateJobRunInput): Promise<JobRun>;
  listTicketRuns(limit?: number): Promise<TicketRun[]>;
  listTicketRunsForJob(jobKey: string, jobName?: string | null, limit?: number): Promise<TicketRun[]>;
  listTicketRunsByJiraKey(jiraKey: string, limit?: number): Promise<TicketRun[]>;
  listJobRunsByIds(ids: string[]): Promise<JobRun[]>;
  createTicketRun(input: CreateTicketRunInput): Promise<TicketRun>;
  getDashboardSummary(): Promise<DashboardSummary>;
  listChatMessages(sessionKey: string, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(input: CreateChatMessageInput): Promise<ChatMessage>;
  listChatSessions(userId: string, limit?: number): Promise<ChatSession[]>;
  getChatSession(sessionKey: string): Promise<ChatSession | null>;
  ensureChatSession(input: { sessionKey: string; userId: string; title?: string | null }): Promise<ChatSession>;
  renameChatSession(input: { sessionKey: string; userId: string; title: string }): Promise<ChatSession | null>;
  deleteChatSession(input: { sessionKey: string; userId: string }): Promise<boolean>;
};

function mapJob(row: Record<string, unknown>): Job {
  return {
    id: String(row.id),
    key: String(row.key),
    name: String(row.name),
    schedule: String(row.schedule),
    enabled: Boolean(row.enabled),
    lastRunAt: row.last_run_at ? new Date(String(row.last_run_at)).toISOString() : null,
    lastStatus: row.last_status ? String(row.last_status) : null,
    runningAt: row.running_at ? new Date(String(row.running_at)).toISOString() : null,
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

function mapChatMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    sessionKey: String(row.session_key),
    userId: String(row.user_id),
    role: String(row.role) === 'assistant' ? 'assistant' : 'user',
    content: String(row.content),
    meta: (row.meta as Record<string, unknown> | null) ?? {},
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapChatSession(row: Record<string, unknown>): ChatSession {
  return {
    sessionKey: String(row.session_key),
    userId: String(row.user_id),
    title: String(row.title ?? 'Nueva conversación'),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    lastMessageAt: row.last_message_at ? new Date(String(row.last_message_at)).toISOString() : null,
    messageCount: Number(row.message_count ?? 0),
    preview: row.preview ? String(row.preview) : null,
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

    async syncJobs(jobs) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const seenKeys = new Set<string>();
        for (const job of jobs) {
          seenKeys.add(job.key);
          const id = randomUUID();
          await client.query(
            `INSERT INTO jobs (id, key, name, schedule, enabled, next_run_at, last_run_at, last_status, running_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (key)
             DO UPDATE SET
               name = EXCLUDED.name,
               schedule = EXCLUDED.schedule,
               enabled = EXCLUDED.enabled,
               next_run_at = EXCLUDED.next_run_at,
               last_run_at = EXCLUDED.last_run_at,
               last_status = EXCLUDED.last_status,
               running_at = EXCLUDED.running_at,
               updated_at = NOW()`,
            [id, job.key, job.name, job.schedule, job.enabled ?? true, job.nextRunAt ?? null, job.lastRunAt ?? null, job.lastStatus ?? null, job.runningAt ?? null],
          );
        }
        if (seenKeys.size) {
          await client.query(`DELETE FROM jobs WHERE key LIKE 'cron:%' AND NOT (key = ANY($1::text[]))`, [[...seenKeys]]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
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

    async listTicketRunsForJob(jobKey, jobName = null, limit = 20) {
      const result = await pool.query(
        `SELECT *
         FROM ticket_runs
         WHERE (data->>'jobKey' = $1)
            OR ($2::text IS NOT NULL AND data->>'jobName' = $2)
         ORDER BY started_at DESC
         LIMIT $3`,
        [jobKey, jobName, limit],
      );
      return result.rows.map((row) => mapTicketRun(row));
    },

    async listTicketRunsByJiraKey(jiraKey, limit = 20) {
      const result = await pool.query(
        'SELECT * FROM ticket_runs WHERE jira_key = $1 ORDER BY started_at DESC LIMIT $2',
        [jiraKey, limit],
      );
      return result.rows.map((row) => mapTicketRun(row));
    },

    async listJobRunsByIds(ids) {
      if (!ids.length) return [];
      const result = await pool.query('SELECT * FROM job_runs WHERE id = ANY($1::uuid[]) ORDER BY started_at DESC', [ids]);
      return result.rows.map((row) => mapJobRun(row));
    },

    async createTicketRun(input) {
      const id = randomUUID();
      const result = await pool.query(
        `INSERT INTO ticket_runs (id, job_run_id, jira_key, jira_summary, jira_status, dispatch_status, score, branch_name, pr_url, note, test_summary, finished_at, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          id,
          input.jobRunId ?? null,
          input.jiraKey,
          input.jiraSummary ?? null,
          input.jiraStatus ?? null,
          input.dispatchStatus,
          input.score ?? null,
          input.branchName ?? null,
          input.prUrl ?? null,
          input.note ?? null,
          input.testSummary ?? null,
          input.finishedAt ?? null,
          input.data ?? {},
        ],
      );
      return mapTicketRun(result.rows[0]);
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
              CASE WHEN lower(tr.dispatch_status) IN ('cancelled', 'rejected', 'needs_human') THEN 'warning'::text ELSE 'error'::text END AS severity,
              COALESCE(tr.finished_at, tr.started_at) AS occurred_at
            FROM ticket_runs tr
            WHERE lower(tr.dispatch_status) IN ('failed', 'error', 'errored', 'cancelled', 'rejected', 'needs_human')
          ) notifications
          ORDER BY occurred_at DESC
          LIMIT 8
        `),
        pool.query('SELECT * FROM jobs ORDER BY updated_at DESC, created_at DESC LIMIT 6'),
        pool.query(`
          SELECT *
          FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY jira_key ORDER BY started_at DESC) AS rn
            FROM ticket_runs
          ) recent_ticket_runs
          WHERE rn = 1
          ORDER BY started_at DESC
          LIMIT 8
        `),
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

    async listChatMessages(sessionKey, limit = 100) {
      const result = await pool.query(
        `SELECT *
         FROM (
           SELECT * FROM chat_messages
           WHERE session_key = $1
           ORDER BY created_at DESC
           LIMIT $2
         ) recent
         ORDER BY created_at ASC`,
        [sessionKey, limit],
      );
      return result.rows.map((row) => mapChatMessage(row));
    },

    async listChatSessions(userId, limit = 50) {
      const result = await pool.query(
        `SELECT
           cs.session_key,
           cs.user_id,
           cs.title,
           cs.created_at,
           cs.updated_at,
           lm.last_message_at,
           COALESCE(mc.message_count, 0) AS message_count,
           lm.preview
         FROM chat_sessions cs
         LEFT JOIN (
           SELECT DISTINCT ON (session_key)
             session_key,
             created_at AS last_message_at,
             content AS preview
           FROM chat_messages
           ORDER BY session_key, created_at DESC
         ) lm ON lm.session_key = cs.session_key
         LEFT JOIN (
           SELECT session_key, COUNT(*)::int AS message_count
           FROM chat_messages
           GROUP BY session_key
         ) mc ON mc.session_key = cs.session_key
         WHERE cs.user_id = $1
           AND cs.deleted_at IS NULL
         ORDER BY COALESCE(lm.last_message_at, cs.updated_at) DESC, cs.created_at DESC
         LIMIT $2`,
        [userId, limit],
      );
      return result.rows.map((row) => mapChatSession(row));
    },

    async getChatSession(sessionKey) {
      const result = await pool.query(
        `SELECT
           cs.session_key,
           cs.user_id,
           cs.title,
           cs.created_at,
           cs.updated_at,
           lm.last_message_at,
           COALESCE(mc.message_count, 0) AS message_count,
           lm.preview
         FROM chat_sessions cs
         LEFT JOIN (
           SELECT DISTINCT ON (session_key)
             session_key,
             created_at AS last_message_at,
             content AS preview
           FROM chat_messages
           ORDER BY session_key, created_at DESC
         ) lm ON lm.session_key = cs.session_key
         LEFT JOIN (
           SELECT session_key, COUNT(*)::int AS message_count
           FROM chat_messages
           GROUP BY session_key
         ) mc ON mc.session_key = cs.session_key
         WHERE cs.session_key = $1
           AND cs.deleted_at IS NULL
         LIMIT 1`,
        [sessionKey],
      );
      return result.rowCount ? mapChatSession(result.rows[0]) : null;
    },

    async ensureChatSession(input) {
      await pool.query(
        `INSERT INTO chat_sessions (session_key, user_id, title)
         VALUES ($1, $2, $3)
         ON CONFLICT (session_key)
         DO UPDATE SET
           user_id = EXCLUDED.user_id,
           title = COALESCE(NULLIF(chat_sessions.title, ''), EXCLUDED.title),
           deleted_at = NULL,
           updated_at = NOW()`,
        [input.sessionKey, input.userId, input.title?.trim() || 'Nueva conversación'],
      );

      const session = await this.getChatSession(input.sessionKey);
      if (!session) throw new Error('chat_session_not_found_after_upsert');
      return session;
    },

    async renameChatSession(input) {
      const result = await pool.query(
        `UPDATE chat_sessions
         SET title = $3,
             updated_at = NOW()
         WHERE session_key = $1
           AND user_id = $2
           AND deleted_at IS NULL
         RETURNING session_key`,
        [input.sessionKey, input.userId, input.title],
      );
      if (!result.rowCount) return null;
      return this.getChatSession(input.sessionKey);
    },

    async deleteChatSession(input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const update = await client.query(
          `UPDATE chat_sessions
           SET deleted_at = NOW(), updated_at = NOW()
           WHERE session_key = $1
             AND user_id = $2
             AND deleted_at IS NULL`,
          [input.sessionKey, input.userId],
        );
        if (!update.rowCount) {
          await client.query('ROLLBACK');
          return false;
        }
        await client.query('DELETE FROM chat_messages WHERE session_key = $1 AND user_id = $2', [input.sessionKey, input.userId]);
        await client.query('COMMIT');
        return true;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async createChatMessage(input) {
      await this.ensureChatSession({
        sessionKey: input.sessionKey,
        userId: input.userId,
        title: input.role === 'user' ? input.content : 'Nueva conversación',
      });

      const id = randomUUID();
      const result = await pool.query(
        `INSERT INTO chat_messages (id, session_key, user_id, role, content, meta)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, input.sessionKey, input.userId, input.role, input.content, input.meta ?? {}],
      );

      await pool.query(
        `UPDATE chat_sessions
         SET updated_at = NOW(),
             title = CASE
               WHEN (title IS NULL OR title = '' OR title = 'Nueva conversación') AND $3 = 'user' THEN LEFT($4, 80)
               ELSE title
             END
         WHERE session_key = $1
           AND user_id = $2`,
        [input.sessionKey, input.userId, input.role, input.content],
      );

      return mapChatMessage(result.rows[0]);
    },
  };
}
