import { prisma } from '../config/database';

export async function trackAiUsage(params: {
  provider: string;
  function: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  userId?: string;
}) {
  try {
    const total = params.totalTokens || (params.inputTokens || 0) + (params.outputTokens || 0);
    await (prisma as any).aiUsage.create({
      data: {
        provider: params.provider,
        function: params.function,
        model: params.model || null,
        inputTokens: params.inputTokens || 0,
        outputTokens: params.outputTokens || 0,
        totalTokens: total,
        userId: params.userId || null,
      },
    });
  } catch (e) {
    // Tracking-Fehler sollen nie die eigentliche Funktion blockieren
    console.error('[AI Usage] Tracking fehlgeschlagen:', e);
  }
}
