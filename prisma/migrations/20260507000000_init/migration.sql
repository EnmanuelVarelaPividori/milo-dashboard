-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."jobs" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ(6),
    "next_run_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."job_runs" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "summary" TEXT,
    "error" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ticket_runs" (
    "id" UUID NOT NULL,
    "job_run_id" UUID,
    "jira_key" TEXT NOT NULL,
    "jira_summary" TEXT,
    "jira_status" TEXT,
    "dispatch_status" TEXT NOT NULL,
    "score" INTEGER,
    "branch_name" TEXT,
    "pr_url" TEXT,
    "note" TEXT,
    "test_summary" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "data" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ticket_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_key_key" ON "public"."jobs"("key");

-- CreateIndex
CREATE INDEX "ticket_runs_jira_key_started_at_idx" ON "public"."ticket_runs"("jira_key", "started_at");

-- AddForeignKey
ALTER TABLE "public"."job_runs" ADD CONSTRAINT "job_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_runs" ADD CONSTRAINT "ticket_runs_job_run_id_fkey" FOREIGN KEY ("job_run_id") REFERENCES "public"."job_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

