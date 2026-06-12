CREATE TABLE IF NOT EXISTS "system_metrics" (
  "id" SERIAL PRIMARY KEY,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "cpuUsage" INTEGER NOT NULL,
  "ramUsage" INTEGER NOT NULL,
  "ramTotal" BIGINT NOT NULL,
  "ramFree" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS "system_metrics_timestamp_idx" ON "system_metrics"("timestamp");