CREATE TABLE "ai_usage" (
    "id"          TEXT NOT NULL,
    "provider"    TEXT NOT NULL,
    "function"    TEXT NOT NULL,
    "model"       TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "userId"      TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_usage_provider_idx" ON "ai_usage"("provider");
CREATE INDEX "ai_usage_function_idx" ON "ai_usage"("function");
CREATE INDEX "ai_usage_createdAt_idx" ON "ai_usage"("createdAt");
