// scripts/audit-logs/migrate-from-user-action-logs.ts
//
// 旧 user_action_logs テーブルから新 audit_logs テーブルへ移行する。
//
// 設計方針:
// - 冪等: audit_logs に同じ created_at + targetId + action のレコードがあれば
//   挿入をスキップ（onConflictDoNothing 相当を unique 判定で実装）。
// - dry-run: --dry-run で 1 件も書かずにマッピングと件数を確認できる。
// - 進捗表示: --batch-size 単位で進捗を出力。
// - 未知 action_type はデフォルトで停止。--allow-unknown で `user.legacy_<旧名>` に逃がす。
//
// auditLogger.record() は経由しない（1 件ずつ tx を開くため大量データで非効率）。
// 直接 db.insert() にバッチ投入する。
//
// 使い方:
//   pnpm audit:migrate -- --dry-run
//   pnpm audit:migrate
//   pnpm audit:migrate -- --limit 100 --batch-size 50
//   pnpm audit:migrate -- --allow-unknown

import { config } from "dotenv";

// .env.development を読み込む（import 文より先に実行）
config({ path: ".env.development" });

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { AuditLogTable } from "@/features/core/auditLog/entities/drizzle";
import { UserActionLogTable } from "@/features/core/userActionLog/entities/drizzle";
import { DEFAULT_RETENTION_DAYS } from "@/features/core/auditLog/constants";

/**
 * 旧 action_type → 新 action 名のマッピング表。
 * Phase 3 で再設計した規約 (<domain>.<entity>.<verb_past>) に揃える。
 */
const ACTION_TYPE_MAP: Record<string, string> = {
  admin_create_user: "user.created_by_admin",
  admin_reregister_user: "user.reregistered_by_admin",
  admin_status_change: "user.status.changed",
  admin_role_change: "user.role.changed",
  admin_profile_update: "user.profile.updated",
  admin_soft_delete: "user.soft_deleted",
  admin_hard_delete: "user.hard_deleted",
  user_preregister: "user.preregistered",
  user_register: "user.registered",
  user_pause: "user.paused",
  user_reactivate: "user.reactivated",
  user_withdraw: "user.withdrew",
  user_rejoin: "user.rejoined",
  other: "user.other",
};

/**
 * actor_type は subset 関係なのでそのまま流用。
 * (system | admin | user) → audit_logs.actor_type に同じ値が入る。
 */
const VALID_ACTOR_TYPES = new Set(["system", "admin", "user"]);

type CliOptions = {
  dryRun: boolean;
  limit: number | null;
  batchSize: number;
  allowUnknown: boolean;
};

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = {
    dryRun: false,
    limit: null,
    batchSize: 1000,
    allowUnknown: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--":
        // pnpm 経由でセパレータがそのまま argv に入るケースを無視
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--allow-unknown":
        opts.allowUnknown = true;
        break;
      case "--limit": {
        const value = args[++i];
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error(`--limit には正の整数を指定してください: ${value}`);
        }
        opts.limit = n;
        break;
      }
      case "--batch-size": {
        const value = args[++i];
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error(`--batch-size には正の整数を指定してください: ${value}`);
        }
        opts.batchSize = n;
        break;
      }
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`未知のオプション: ${arg}`);
    }
  }

  return opts;
}

function printHelp(): void {
  console.log(`
使い方:
  pnpm audit:migrate [-- options]

オプション:
  --dry-run            DB に書き込まずマッピングと件数だけ報告する
  --limit N            移行する最大件数 (検証用)
  --batch-size N       1 バッチあたりの件数 (既定: 1000)
  --allow-unknown      未知の action_type を user.legacy_<旧名> に変換して通す
                       (既定では停止)
  -h, --help           このヘルプを表示

冪等性:
  audit_logs に同じ (created_at, target_id, action) を持つ行があればスキップ。
  途中で失敗しても再実行で残りだけ処理される。
`);
}

/**
 * 旧 action_type を新 action 名に変換する。
 * 未知の場合はオプションに応じて throw またはフォールバック。
 */
function mapAction(actionType: string, allowUnknown: boolean): string {
  const mapped = ACTION_TYPE_MAP[actionType];
  if (mapped) return mapped;
  if (allowUnknown) return `user.legacy_${actionType}`;
  throw new Error(
    `未知の action_type: "${actionType}" — マッピングを追加するか --allow-unknown を指定してください`,
  );
}

/**
 * 旧 actor_type を新 actor_type に変換する。
 * 想定外の値は "system" にフォールバック (旧データの異常値対策)。
 */
function mapActorType(actorType: string): "system" | "admin" | "user" {
  if (VALID_ACTOR_TYPES.has(actorType)) {
    return actorType as "system" | "admin" | "user";
  }
  console.warn(`[警告] 未知の actor_type "${actorType}" を system にフォールバック`);
  return "system";
}

/**
 * 移行済みかどうかを判定する (created_at + target_id + action の組で重複検出)。
 * 同じ秒に同じ操作が複数回起きるケースは稀なので、この組み合わせで実用上十分。
 */
async function isAlreadyMigrated(row: {
  createdAt: Date;
  targetUserId: string;
  action: string;
}): Promise<boolean> {
  const result = await db
    .select({ id: AuditLogTable.id })
    .from(AuditLogTable)
    .where(
      and(
        eq(AuditLogTable.targetType, "user"),
        eq(AuditLogTable.targetId, row.targetUserId),
        eq(AuditLogTable.action, row.action),
        eq(AuditLogTable.createdAt, row.createdAt),
      ),
    )
    .limit(1);
  return result.length > 0;
}

async function main() {
  const opts = parseArgs();

  console.log("📦 audit_logs への移行を開始します");
  console.log(`   dry-run: ${opts.dryRun}`);
  console.log(`   limit: ${opts.limit ?? "なし (全件)"}`);
  console.log(`   batch-size: ${opts.batchSize}`);
  console.log(`   allow-unknown: ${opts.allowUnknown}`);
  console.log("");

  // 1. 旧テーブルの件数を確認
  const totalRows = (await db
    .select({ count: sql<number>`count(*)` })
    .from(UserActionLogTable))[0];
  const totalCount = Number(totalRows.count);

  if (totalCount === 0) {
    console.log("✅ user_action_logs に移行対象がありません。終了します。");
    return;
  }

  console.log(`📊 user_action_logs: ${totalCount} 件`);

  // 2. 全件取得 (ページング)
  const sourceLimit = opts.limit ?? totalCount;
  console.log(`📥 取得対象: ${sourceLimit} 件`);
  console.log("");

  let migrated = 0;
  let skipped = 0;
  let unknownCount = 0;
  let processed = 0;

  // バッチごとにオフセットを進める
  const fetchBatchSize = Math.max(opts.batchSize, 1);

  for (let offset = 0; offset < sourceLimit; offset += fetchBatchSize) {
    const remaining = sourceLimit - offset;
    const take = Math.min(fetchBatchSize, remaining);

    const sourceRows = await db
      .select()
      .from(UserActionLogTable)
      .orderBy(UserActionLogTable.createdAt)
      .limit(take)
      .offset(offset);

    if (sourceRows.length === 0) break;

    const rowsToInsert: Array<typeof AuditLogTable.$inferInsert> = [];

    for (const row of sourceRows) {
      processed++;

      let action: string;
      try {
        action = mapAction(row.actionType, opts.allowUnknown);
      } catch (e) {
        console.error(`❌ ${(e as Error).message}`);
        console.error(`   行 id: ${row.id}, target_user_id: ${row.targetUserId}`);
        process.exit(1);
      }

      if (action.startsWith("user.legacy_")) unknownCount++;

      const candidate = {
        createdAt: row.createdAt,
        targetUserId: row.targetUserId,
        action,
      };

      // 冪等性チェック
      if (await isAlreadyMigrated(candidate)) {
        skipped++;
        continue;
      }

      rowsToInsert.push({
        targetType: "user",
        targetId: row.targetUserId,
        actorId: row.actorId,
        actorType: mapActorType(row.actorType),
        action,
        beforeValue: row.beforeValue ?? null,
        afterValue: row.afterValue ?? null,
        context: {
          migrated: true,
          sourceTable: "user_action_logs",
          sourceId: row.id,
        },
        metadata: null,
        reason: row.reason,
        retentionDays: DEFAULT_RETENTION_DAYS,
        createdAt: row.createdAt,
      });
    }

    if (!opts.dryRun && rowsToInsert.length > 0) {
      await db.insert(AuditLogTable).values(rowsToInsert);
    }
    migrated += rowsToInsert.length;

    const progress = Math.min(offset + sourceRows.length, sourceLimit);
    console.log(
      `  進捗: ${progress}/${sourceLimit} (insert ${migrated} / skip ${skipped})`,
    );

    // limit に達したら終了
    if (sourceRows.length < take) break;
  }

  console.log("");
  console.log("📊 結果サマリ");
  console.log(`   処理対象:        ${processed} 件`);
  console.log(`   ${opts.dryRun ? "insert 予定" : "insert 完了"}: ${migrated} 件`);
  console.log(`   既移行スキップ:   ${skipped} 件`);
  if (unknownCount > 0) {
    console.log(`   未知 action 変換: ${unknownCount} 件 (user.legacy_*)`);
  }

  if (opts.dryRun) {
    console.log("");
    console.log("ℹ️  dry-run のため DB に書き込みはしていません。");
    console.log("   問題なければ --dry-run なしで再実行してください。");
  }
}

main()
  .then(async () => {
    await db.$client?.end?.();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("❌ 移行に失敗しました:", e);
    await db.$client?.end?.();
    process.exit(1);
  });
