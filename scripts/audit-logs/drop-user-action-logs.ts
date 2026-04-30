// scripts/audit-logs/drop-user-action-logs.ts
//
// 旧 user_action_logs テーブルを物理的に削除する。
//
// migrate-from-user-action-logs.ts と分離している理由:
//   - 移行→検証→削除 の 3 段階を明示的に踏ませるため
//   - 検証前に誤って削除する事故を構造的に防ぐため
//
// 安全策:
//   - audit_logs に user 系レコードが 1 件もない場合は停止 (＝移行未実施の疑い)
//   - --confirm フラグが必須
//   - --dry-run でテーブル状態だけ確認可能
//
// 使い方:
//   pnpm audit:drop-legacy -- --dry-run
//   pnpm audit:drop-legacy -- --confirm

import { config } from "dotenv";

config({ path: ".env.development" });

import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { AuditLogTable } from "@/features/core/auditLog/entities/drizzle";
import { UserActionLogTable } from "@/features/core/userActionLog/entities/drizzle";

type CliOptions = {
  dryRun: boolean;
  confirm: boolean;
};

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = { dryRun: false, confirm: false };
  for (const arg of args) {
    if (arg === "--") continue; // pnpm セパレータ
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--confirm") opts.confirm = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`
使い方:
  pnpm audit:drop-legacy [-- options]

オプション:
  --dry-run    削除せず、影響件数だけ報告する
  --confirm    削除を実行する (これがないと停止)
  -h, --help   このヘルプを表示

実行前に必ず audit:migrate を完了させてください。
`);
      process.exit(0);
    } else {
      throw new Error(`未知のオプション: ${arg}`);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();

  console.log("🗑  user_action_logs テーブルの削除");
  console.log(`   dry-run: ${opts.dryRun}`);
  console.log(`   confirm: ${opts.confirm}`);
  console.log("");

  // 1. 件数確認
  const oldCount = Number(
    (await db.select({ count: sql<number>`count(*)` }).from(UserActionLogTable))[0].count,
  );
  const newUserCount = Number(
    (
      await db
        .select({ count: sql<number>`count(*)` })
        .from(AuditLogTable)
        .where(eq(AuditLogTable.targetType, "user"))
    )[0].count,
  );

  console.log(`📊 user_action_logs:               ${oldCount} 件`);
  console.log(`📊 audit_logs (target_type=user):   ${newUserCount} 件`);
  console.log("");

  // 2. 安全策: 旧データがあるのに新側に何も無ければ停止
  if (oldCount > 0 && newUserCount === 0) {
    console.error(
      "❌ user_action_logs にレコードがあるのに audit_logs に user 系ログがありません。",
    );
    console.error("   移行が未実施の可能性があります。pnpm audit:migrate を先に実行してください。");
    process.exit(1);
  }

  if (opts.dryRun) {
    console.log("ℹ️  dry-run のため変更は行いません。");
    console.log("   削除を実行するには --confirm を付けて再実行してください。");
    return;
  }

  if (!opts.confirm) {
    console.error("❌ 削除には --confirm が必須です (事故防止)。");
    console.error("   --dry-run で内容確認 → --confirm で実行 の 2 段階で進めてください。");
    process.exit(1);
  }

  // 3. 削除実行 (CASCADE で enum も削除)
  console.log("🚮 user_action_logs テーブルを削除します...");
  await db.execute(sql`DROP TABLE IF EXISTS user_action_logs CASCADE`);
  await db.execute(sql`DROP TYPE IF EXISTS user_action_type CASCADE`);
  await db.execute(sql`DROP TYPE IF EXISTS user_action_actor_type CASCADE`);
  console.log("✅ 削除完了");
  console.log("");
  console.log("次のステップ: features/core/userActionLog/ ディレクトリと registry の登録を削除してください。");
  console.log("   テンプレート最新版では既に削除済みのため、git pull で済むはずです。");
}

main()
  .then(async () => {
    await db.$client?.end?.();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("❌ 削除に失敗しました:", e);
    await db.$client?.end?.();
    process.exit(1);
  });
