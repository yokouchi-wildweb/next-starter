// src/app/api/me/email/confirm/route.ts

import { createMeRoute } from "@/wiring/apiRoute";
import { confirmEmailChange } from "@/features/core/auth/services/server/confirmEmailChange";

/**
 * Firebase Auth側で更新されたメールアドレスをDBに同期します。
 * Cookie セッションの本人(ctx.user)について、Firebase Auth の最新メールアドレスをDBに反映します(本体は auth のサービス)。
 */
export const POST = createMeRoute(
  {
    operation: "POST /api/me/email/confirm",
    operationType: "write",
  },
  async (_req, { user }) => confirmEmailChange(user.userId),
);
