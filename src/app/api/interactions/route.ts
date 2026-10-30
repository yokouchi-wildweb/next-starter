// src/app/api/interactions/route.ts
// インタラクション計測の公開 ingest エンドポイント
//
// 匿名ユーザーを含む行動イベント（クリック等）を記録する。
// - 一覧 targetRules に無い targetType は fail-closed で拒否
//   （存在しない対象・非公開対象へのカウント水増し防止）
// - ログイン中（利用可能な status）は ctx.user から userId を自動付与（クライアント申告は受け付けない）
// - IP / サブネットのハイブリッドレート制限でボットによる水増しを緩和

import { createApiRoute } from "@/wiring/apiRoute";
import { DomainError } from "@/lib/errors/domainError";
import { InteractionIngestSchema } from "@/features/core/interactionTracking/entities/schema";
import { record } from "@/features/core/interactionTracking/services/server";
import { targetRules } from "@/features/core/interactionTracking/extensions/targetRules";

export const POST = createApiRoute(
  {
    operation: "POST /api/interactions",
    operationType: "write",
    access: "public",
    rateLimit: "interactionIngest",
    rateLimitSubnet: "interactionIngestSubnet",
  },
  async (req, { user }) => {
    const parsed = InteractionIngestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new DomainError("リクエスト形式が不正です。", { status: 400 });
    }
    const { targetType, targetId, action, source } = parsed.data;

    const rule = targetRules[targetType];
    if (!rule) {
      throw new DomainError("計測対象として登録されていません。", { status: 400 });
    }
    if (rule.allowedActions && !rule.allowedActions.includes(action)) {
      throw new DomainError("許可されていないアクションです。", { status: 400 });
    }

    // 例外も「受け入れ不可」として扱う（fail-closed）
    const accepted = await rule.validate(targetId).catch(() => false);
    if (!accepted) {
      throw new DomainError("計測対象が見つかりません。", { status: 404 });
    }

    await record({
      targetType,
      targetId,
      action,
      source: source ?? null,
      userId: user?.userId ?? null,
      retentionDays: rule.retentionDays,
      recordDetail: rule.recordDetail,
    });

    return { recorded: true };
  },
);
