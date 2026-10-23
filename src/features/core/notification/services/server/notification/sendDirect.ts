// src/features/core/notification/services/server/notification/sendDirect.ts
// 自由入力によるお知らせ送信
// image（storage ref）は insert と同じ TX で、drizzleBase の storage binding によりファイル台帳に紐付ける
// （base.create を通らない直接 insert なので、ここで明示的に呼ぶ）。アップロードした本人（送信した管理者）の
// 未紐付けの ref だけが通り、新しい旧 URL・外部 URL は 400。null はそのまま

import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import type { Notification } from "@/features/core/notification/entities/model";
import { storageBinding } from "@/features/core/notification/services/server/drizzleBase";

export type SendDirectInput = {
  title?: string | null;
  body: string;
  image?: string | null;
  targetType: "all" | "role" | "individual";
  targetUserIds?: string[] | null;
  targetRoles?: string[] | null;
  senderType: "admin" | "system";
  createdById?: string | null;
  metadata?: Record<string, unknown> | null;
  silent?: boolean;
  publishedAt?: Date | null;
};

export async function sendDirect(input: SendDirectInput): Promise<Notification> {
  // target_type に応じたバリデーション
  validateTarget(input);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(NotificationTable)
      .values({
        title: input.title ?? null,
        body: input.body,
        image: input.image ?? null,
        target_type: input.targetType,
        target_user_ids: input.targetType === "individual" ? input.targetUserIds : null,
        target_roles: input.targetType === "role" ? input.targetRoles : null,
        sender_type: input.senderType,
        created_by_id: input.createdById ?? null,
        metadata: input.metadata ?? null,
        is_silent: input.silent ?? false,
        published_at: input.publishedAt ?? new Date(),
      })
      .returning();

    await storageBinding.afterWrite(tx, null, created as Record<string, unknown>);
    return created as Notification;
  });
}

function validateTarget(input: SendDirectInput): void {
  switch (input.targetType) {
    case "individual":
      if (!input.targetUserIds?.length) {
        throw new DomainError(
          "個別指定の場合、対象ユーザーIDを1件以上指定してください。",
          { status: 400 }
        );
      }
      break;
    case "role":
      if (!input.targetRoles?.length) {
        throw new DomainError(
          "ロール指定の場合、対象ロールを1件以上指定してください。",
          { status: 400 }
        );
      }
      break;
    case "all":
      // バリデーション不要
      break;
  }
}
