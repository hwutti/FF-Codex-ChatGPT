CREATE TABLE IF NOT EXISTS "disk_metrics" (
  "id" SERIAL PRIMARY KEY,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "partition" TEXT NOT NULL,
  "total" BIGINT NOT NULL,
  "free" BIGINT NOT NULL,
  "used" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS "disk_metrics_timestamp_idx" ON "disk_metrics"("timestamp");
CREATE INDEX IF NOT EXISTS "disk_metrics_partition_idx" ON "disk_metrics"("partition");