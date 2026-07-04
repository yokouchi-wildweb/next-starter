// src/app/api/interactions/batch/route.ts
// インタラクション計測のバッチ ingest エンドポイント（インプレッション等の高頻度イベント用）
//
// クライアント側で集約済みの (target × action × source) → count を一括で受け取り、
// 集計カウンタ（累計 + 日次）のみ加算する。イベント明細は書かない。
// - registry の batchActions に明示された action のみ受け付ける（fail-closed）。
//   count をまとめて申告できる経路のため、クリック等の 1操作=1加算 で守る action は
//   ここを通れない（水増し防止）
// - 検証に失敗したエントリは棄却して残りを処理する（計測はベストエフォート）
// - 送信は impressionTracker（services/client）経由を想定。pagehide 時は
//   sendBeacon で届くため、Content-Type は application/json 前提で req.json() で読む

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors/domainError";
import { InteractionBatchIngestSchema } from "@/features/core/interactionTracking/entities/schema";
import { recordBatch, type RecordBatchEntry } from "@/features/core/interactionTracking/services/server";
import { interactionTargetRegistry } from "@/registry/interactionTargetRegistry";

export const POST = createApiRoute(
  {
    operation: "POST /api/interactions/batch",
    operationType: "write",
    access: "public",
    rateLimit: "interactionBatch",
    rateLimitSubnet: "interactionBatchSubnet",
  },
  async (req) => {
    const parsed = InteractionBatchIngestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new DomainError("リクエスト形式が不正です。", { status: 400 });
    }

    const accepted: RecordBatchEntry[] = [];
    let rejected = 0;
    // 同一対象の validate を 1 バッチ内で使い回す（対象数ぶんだけ検証する）
    const validationCache = new Map<string, Promise<boolean>>();

    for (const entry of parsed.data.events) {
      const rule = interactionTargetRegistry[entry.targetType];
      // batchActions 未設定の targetType はバッチ経路を一切受け付けない（fail-closed）
      if (!rule?.batchActions?.includes(entry.action)) {
        rejected += 1;
        continue;
      }

      const cacheKey = `${entry.targetType} ${entry.targetId}`;
      let validation = validationCache.get(cacheKey);
      if (!validation) {
        // 例外も「受け入れ不可」として扱う（fail-closed）
        validation = rule.validate(entry.targetId).catch(() => false);
        validationCache.set(cacheKey, validation);
      }
      if (!(await validation)) {
        rejected += 1;
        continue;
      }

      accepted.push({
        targetType: entry.targetType,
        targetId: entry.targetId,
        action: entry.action,
        source: entry.source ?? null,
        count: entry.count,
      });
    }

    if (accepted.length > 0) {
      await recordBatch(accepted);
    }

    return { recorded: accepted.length, rejected };
  },
);
