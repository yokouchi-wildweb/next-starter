// scripts/operations/db/clear.ts(pnpm db:clear / db:clear:all)
//
// 選んだ表のデータを全部消す。
// - 閉じた機能の表(@/featureGate/node の closedTables)には触れない。--include-closed のときだけ選べ・参照元に足せる
// - 消す表を参照する表(外部キー)を先に計算し、確認の前に「選んだ表 / 足した参照元 / 外した表」を見せる
// - DB にある閉じた表が消す表を参照していれば、何も消さずに並べて exit 1
// - 1 文の TRUNCATE ... RESTRICT で消す(全部消えるか、何も消えないか。連鎖の削除は使わない)
//
// 計画は plan.ts(純関数、pnpm test:db-clear)。詳細: src/featureGate/README.md「db:clear と閉じた機能の表」
//
// フラグ: --all(選べる表を全部、対話なし) | --include-closed(閉じた機能の表も対象にする)

import { config } from "dotenv";
import { checkbox, confirm } from "@inquirer/prompts";

// .env.development を読み込む（import文より先に実行）
config({ path: ".env.development" });

const printList = (label: string, names: readonly string[]) => {
  console.log(`${label}(${names.length}件)${names.length > 0 ? `: ${names.join(", ")}` : ""}`);
};

async function main() {
  console.log("🗑️  データベースのテーブルクリア");
  console.log("");

  const runAll = process.argv.includes("--all");
  const includeClosed = process.argv.includes("--include-closed");

  // 環境変数読み込み後に動的import
  const [{ sql }, { db }, schema, gateNode, plan] = await Promise.all([
    import("drizzle-orm"),
    import("@/lib/drizzle"),
    import("@/registry/schemaRegistry"),
    import("@/featureGate/node"),
    import("./clear/plan"),
  ]);

  const graph = plan.readTableGraph(schema);
  if (graph.names.length === 0) {
    console.log("テーブルが見つかりませんでした。");
    process.exit(0);
  }

  const closedTables = gateNode.closedTables(gateNode.rules);
  const { selectable, excludedClosed } = plan.selectableTables(graph, closedTables, includeClosed);

  console.log(`📋 検出されたテーブル: ${graph.names.length}件`);
  if (excludedClosed.length > 0) {
    printList("🔒 閉じた機能の表なので選べない表", excludedClosed);
    console.log("   (閉じた機能の表も消すときは --include-closed)");
  }
  console.log("");

  if (selectable.length === 0) {
    console.log("選べるテーブルがありません。終了します。");
    process.exit(0);
  }

  let selected: string[];
  if (runAll) {
    selected = selectable;
    console.log("📋 選べる全てのテーブルを削除対象とします");
  } else {
    selected = await checkbox<string>({
      message: "削除するテーブルを選択してください（スペースで選択、Enterで確定）",
      choices: selectable.map((name) => ({ name, value: name, checked: true })),
    });
  }

  if (selected.length === 0) {
    console.log("テーブルが選択されませんでした。終了します。");
    process.exit(0);
  }

  // DB にある表(DB に無い表は TRUNCATE を失敗させるので計画で外す)
  const rows = (await db.execute(
    sql`select tablename from pg_tables where schemaname = current_schema()`,
  )) as unknown as Array<{ tablename: string }>;
  const dbTables = rows.map((row) => row.tablename);

  const result = plan.planClear({ graph, closedTables, dbTables, selected, includeClosed });

  console.log("");
  printList("🎯 選んだ表", result.selected);
  printList("➕ 参照元として足した表", result.addedReferrers);
  printList("➖ DB に無いので外した表", result.missingInDb);
  if (result.skippedClosed.length > 0) printList("➖ 閉じた機能の表なので外した表", result.skippedClosed);
  console.log("");

  if (result.blockers.length > 0) {
    console.error("❌ DB にある閉じた機能の表が、消す表を外部キーで参照しています。何も消さずに終了します:");
    for (const blocker of result.blockers) console.error(`   ${blocker.from} → ${blocker.to}`);
    console.error("   (閉じた機能の表も一緒に消すときは --include-closed)");
    process.exit(1);
  }

  if (result.tables.length === 0) {
    console.log("消す表がありません。終了します。");
    process.exit(0);
  }

  const statement = plan.buildTruncateSql(result.tables);

  const confirmed = await confirm({
    message: `⚠️  ${result.tables.length}件のテーブルのレコードを全削除します。よろしいですか？`,
    default: false,
  });
  if (!confirmed) {
    console.log("キャンセルしました。");
    process.exit(0);
  }

  console.log("");
  console.log(`▶ ${statement}`);
  await db.execute(sql.raw(statement));
  console.log(`✅ ${result.tables.length}件のテーブルをクリアしました`);
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ テーブルクリアの実行に失敗しました（1 文なので何も消えていません）:", error);
  process.exit(1);
});
