// scripts/workflow/dev-admin/run.ts
//
// pnpm workflow dev-admin run — 開発用 DB にエージェントの確認用の管理者を用意し、ログイン情報を JSON 1 行で出す。
// pnpm workflow dev-admin run --check — 読むだけ: 管理者がいるかを JSON 1 行で出す(作らない・直さない。守りは読む入口)。
// 開発の進め方の道具(業務の操作ではないので user ドメインのタスクにしない、L1.30)。何をするか・止まる条件は lib.ts の先頭。
// 下準備(env ファイルの読み込み・DB 未設定の止め・監査の system 文脈)はタスクのランナーの部品 scripts/runner/task/prepare.ts を使う。
// server-only の下駄は pnpm workflow が .ts に付ける。利用者を作る処理は userService を動的 import で呼ぶ(DB は直接書かない)。

import { guardEntry } from "../../runner/guard";
import { asSystem, loadEnvFile, requireDatabase } from "../../runner/task/prepare";
import { DEV_ADMIN_EMAIL, DEV_ADMIN_NAME, checkResult, devAdminPassword, notDevelopmentReason } from "./lib";

/** 読むだけ: 管理者がいるか(論理削除済みはいない扱い) */
async function checkDevAdmin(): Promise<Record<string, unknown>> {
  const reason = notDevelopmentReason(process.env);
  if (reason) throw new Error(`dev-admin: ${reason}`);
  await requireDatabase("dev-admin");
  const { userService } = await import("@/features/core/user/services/server/userService");
  return checkResult(await userService.findByLocalEmail(DEV_ADMIN_EMAIL));
}

async function ensureDevAdmin(): Promise<Record<string, unknown>> {
  const reason = notDevelopmentReason(process.env);
  if (reason) throw new Error(`dev-admin: ${reason}`);
  await requireDatabase("dev-admin");

  const { userService } = await import("@/features/core/user/services/server/userService");
  const { verifyPassword } = await import("@/features/core/auth/utils/password");

  const password = devAdminPassword(process.env.AUTH_JWT_SECRET as string);

  const action = await asSystem(async () => {
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
}

const checkOnly = process.argv.slice(2).includes("--check");
if (checkOnly) guardEntry({ write: false, db: true, what: "pnpm workflow dev-admin run --check" });
else loadEnvFile("pnpm workflow dev-admin run");
(checkOnly ? checkDevAdmin() : ensureDevAdmin())
  .then((result) => {
    console.log(JSON.stringify({ level: "info", scope: "dev-admin", ok: true, ...result }));
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ level: "error", scope: "dev-admin", ok: false, ...(checkOnly ? { action: "check" } : {}), error: message }));
    process.exit(1);
  });
