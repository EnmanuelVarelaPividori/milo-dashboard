CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  schedule TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_runs (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  summary TEXT,
  error TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ticket_runs (
  id UUID PRIMARY KEY,
  job_run_id UUID REFERENCES job_runs(id) ON DELETE SET NULL,
  jira_key TEXT NOT NULL,
  jira_summary TEXT,
  jira_status TEXT,
  dispatch_status TEXT NOT NULL,
  score INTEGER,
  branch_name TEXT,
  pr_url TEXT,
  note TEXT,
  test_summary TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ticket_runs_jira_key_started_at_idx ON ticket_runs (jira_key, started_at DESC);
