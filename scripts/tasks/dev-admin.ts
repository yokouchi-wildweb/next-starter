// scripts/tasks/dev-admin.ts
//
// pnpm task dev-admin — 開発用 DB にエージェントの確認用の管理者を用意し、ログイン情報を出す。
// - メール agent-admin@example.test / ロール admin(管理者カテゴリは (user)/(protected) にも入れる)
// - パスワード = AUTH_JWT_SECRET から HMAC で決まる値。env はワークツリーにも複製されるので本体と同じ値になり、記録ファイルが要らない
// - 無ければ userService.createAdmin で作る(runAsSystem の中なので監査に system として残る)
// - あればそのまま使う。パスワードが合わなければ合わせ直し、ロックが掛かっていれば外す。論理削除済みなら createAdmin の復元に任せる
// - 止まる: 段階(APP_ENV、@/lib/appEnv)が development でない / ENV_FILE が .env.development* でない / AUTH_JWT_SECRET が無い / DB 未設定
// 使い方: scripts/tasks/README.md「エージェントの確認用の管理者」

import { createHmac } from "node:crypto";
import path from "node:path";

import { parseAppEnv } from "@/lib/appEnv";

import type { OneShotTask } from "./types";

export const DEV_ADMIN_EMAIL = "agent-admin@example.test";
export const DEV_ADMIN_NAME = "agent-admin";

/** AUTH_JWT_SECRET から決まるパスワード(英数字 24 文字 + 記号 1 つ。パスワードの規則に掛からない形) */
export const devAdminPassword = (secret: string): string =>
  `${createHmac("sha256", secret).update("next-starter:dev-admin").digest("base64url").replace(/[-_]/g, "x").slice(0, 24)}-A1`;

/** 開発環境でないなら理由、開発環境なら null */
export const notDevelopmentReason = (env: NodeJS.ProcessEnv): string | null => {
  if (env.NODE_ENV === "production") return "NODE_ENV=production では動きません";
  const appEnv = path.basename(env.APP_ENV || ".env.development");
  if (!appEnv.startsWith(".env.development")) return `APP_ENV=${env.APP_ENV} では動きません(.env.development* だけ)`;
  if (!env.AUTH_JWT_SECRET) return "AUTH_JWT_SECRET がありません(pnpm ops setup env)";
  return null;
};

export const task: OneShotTask = {
  name: "dev-admin",
  run: async () => {
    const reason = notDevelopmentReason(process.env);
    if (reason) throw new Error(`dev-admin: ${reason}`);

    const { isDatabaseConfigured } = await import("@/lib/drizzle");
    if (!isDatabaseConfigured()) throw new Error("dev-admin: DATABASE_URL が未設定です(DB を設定してから)");

    const { runAsSystem } = await import("@/lib/audit/context");
    const { userService } = await import("@/features/core/user/services/server/userService");
    const { verifyPassword } = await import("@/features/core/auth/utils/password");

    const password = devAdminPassword(process.env.AUTH_JWT_SECRET as string);

    const action = await runAsSystem(async () => {
      const existing = await userService.findByLocalEmail(DEV_ADMIN_EMAIL);
      if (!existing || existing.deletedAt) {
        await userService.createAdmin({ name: DEV_ADMIN_NAME, email: DEV_ADMIN_EMAIL, localPassword: password, role: "admin" });
        return existing ? "restored" : "created";
      }
      const notes: string[] = [];
      if (!(await verifyPassword(password, existing.localPassword))) {
        await userService.update(existing.id, { newPassword: password });
        notes.push("password-reset");
      }
      if (existing.lockedUntil || existing.failedLoginCount > 0) {
        await userService.clearLockState(existing.id);
        notes.push("unlocked");
      }
      if (existing.role !== "admin" || existing.status !== "active") {
        notes.push(`check: role=${existing.role} status=${existing.status}(admin / active に直すのは管理画面で)`);
      }
      return notes.length > 0 ? `existing(${notes.join(", ")})` : "existing";
    });

    return {
      action,
      email: DEV_ADMIN_EMAIL,
      password,
      loginUrl: "/admin/login",
      note: "開発用 DB 専用。管理者カテゴリなので (user)/(protected) のページにも入れる",
    };
  },
};
