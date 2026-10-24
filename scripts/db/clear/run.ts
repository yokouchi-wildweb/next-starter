// scripts/db/clear/run.ts

import { config } from "dotenv";
import { checkbox, confirm } from "@inquirer/prompts";

// .env.development を読み込む（import文より先に実行）
config({ path: ".env.development" });

async function main() {
  console.log("🗑️  データベースのテーブルクリア");
  console.log("");

  // 環境変数読み込み後に動的import
  const { sql, getTableName } = await import("drizzle-orm");
  const { db } = await import("@/lib/drizzle");
  const schema = await import("@/registry/schemaRegistry");

  // schemaRegistry から PgTable オブジェクトを抽出
  const tables: { name: string; table: any }[] = [];
  for (const [key, value] of Object.entries(schema)) {
    // "Table" で終わる名前のエクスポートを対象
    if (key.endsWith("Table") && value && typeof value === "object") {
      try {
        const tableName = getTableName(value as any);
        if (tableName) {
          tables.push({ name: tableName, table: value });
        }
      } catch {
        // getTableName が失敗した場合はスキップ
      }
    }
  }

  if (tables.length === 0) {
    console.log("テーブルが見つかりませんでした。");
    process.exit(0);
  }

  // 重複を除去（同じテーブル名が複数エクスポートされている場合）
  const uniqueTables = Array.from(
    new Map(tables.map((t) => [t.name, t])).values()
  );

  console.log(`📋 検出されたテーブル: ${uniqueTables.length}件`);
  console.log("");

  // --all フラグで全テーブルを削除（インタラクティブ選択をスキップ）
  const runAll = process.argv.includes("--all");

  let selectedTableNames: string[];

  if (runAll) {
    selectedTableNames = uniqueTables.map((t) => t.name);
    console.log("📋 全てのテーブルを削除対象とします");
  } else {
    // チェックボックスで削除するテーブルを選択
    selectedTableNames = await checkbox<string>({
      message:
        "削除するテーブルを選択してください（スペースで選択、Enterで確定）",
      choices: uniqueTables.map((t) => ({
        name: t.name,
        value: t.name,
        checked: true, // デフォルトで全選択
      })),
    });
  }

  if (selectedTableNames.length === 0) {
    console.log("テーブルが選択されませんでした。終了します。");
    process.exit(0);
  }

  console.log("");
  console.log(`🎯 削除対象: ${selectedTableNames.join(", ")}`);
  console.log("");

  // 確認プロンプト
  const confirmed = await confirm({
    message: `⚠️  ${selectedTableNames.length}件のテーブルのレコードを全削除します。よろしいですか？`,
    default: false,
  });

  if (!confirmed) {
    console.log("キャンセルしました。");
    process.exit(0);
  }

  console.log("");

  // TRUNCATE CASCADE で削除（外部キー制約を自動処理）
  for (const tableName of selectedTableNames) {
    console.log(`▶ ${tableName} を削除中...`);
    try {
      await db.execute(sql.raw(`TRUNCATE TABLE "${tableName}" CASCADE`));
      console.log(`  ✅ ${tableName} を削除しました`);
    } catch (error) {
      console.error(`  ❌ ${tableName} の削除に失敗:`, error);
    }
  }

  console.log("");
  console.log("✅ テーブルのクリアが完了しました");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ テーブルクリアの実行に失敗しました:", error);
  process.exit(1);
});
