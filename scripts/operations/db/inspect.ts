// scripts/operations/db/inspect.ts
// データベースCLIツール - クエリ実行、テーブル一覧、構造確認

import { guardEntry } from "../../runner/guard";

// 共通の守り: 向き先(既定は開発)と段階の印。query は任意の SQL を通すので書く入口として扱う(本番は確認)
guardEntry({ write: process.argv[2] === "query", db: true, what: `pnpm ops db inspect ${process.argv[2] ?? ""}`.trim() });

import postgres from "postgres";

import { rowsAsJson, seqScanRows, splitJsonFlag, splitMinRows, SEQ_SCAN_DEFAULT_MIN_ROWS, SEQ_SCAN_FLAG_ROWS } from "./lib.inspect";
import type { SeqScanStatRow } from "./lib.inspect";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

type Command = "query" | "tables" | "describe" | "count" | "seqscans";

function printTable(rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    console.log("(0 rows)");
    return;
  }

  const columns = Object.keys(rows[0]);
  const widths: Record<string, number> = {};

  // 各列の最大幅を計算
  for (const col of columns) {
    widths[col] = col.length;
    for (const row of rows) {
      const val = String(row[col] ?? "NULL");
      widths[col] = Math.max(widths[col], val.length);
    }
    // 最大50文字に制限
    widths[col] = Math.min(widths[col], 50);
  }

  // ヘッダー
  const header = columns.map((col) => col.padEnd(widths[col])).join(" | ");
  const separator = columns.map((col) => "-".repeat(widths[col])).join("-+-");

  console.log(header);
  console.log(separator);

  // データ行
  for (const row of rows) {
    const line = columns
      .map((col) => {
        let val = String(row[col] ?? "NULL");
        if (val.length > 50) val = val.slice(0, 47) + "...";
        return val.padEnd(widths[col]);
      })
      .join(" | ");
    console.log(line);
  }

  console.log(`\n(${rows.length} rows)`);
}

async function runQuery(query: string, json: boolean) {
  try {
    const result = await sql.unsafe(query);
    // --json = 行を JSON の配列 1 つで(機械が読む形。pnpm workflow devcheck が書いた行の id を受け取る)
    if (json) console.log(rowsAsJson(result as unknown as Record<string, unknown>[]));
    else printTable(result as Record<string, unknown>[]);
  } catch (error) {
    console.error("クエリエラー:", (error as Error).message);
    process.exit(1);
  }
}

async function listTables() {
  const result = await sql`
    SELECT table_name,
           pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  printTable(result as Record<string, unknown>[]);
}

async function describeTable(tableName: string) {
  // テーブル存在確認
  const exists = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${tableName}
  `;

  if (exists.length === 0) {
    console.error(`テーブル "${tableName}" が見つかりません`);
    process.exit(1);
  }

  // カラム情報
  console.log(`\n📋 テーブル: ${tableName}\n`);
  console.log("--- カラム ---");

  const columns = await sql`
    SELECT
      column_name as "column",
      data_type as "type",
      is_nullable as "nullable",
      column_default as "default"
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
    ORDER BY ordinal_position
  `;
  printTable(columns as Record<string, unknown>[]);

  // インデックス情報
  console.log("\n--- インデックス ---");
  const indexes = await sql`
    SELECT indexname as "index", indexdef as "definition"
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ${tableName}
  `;
  printTable(indexes as Record<string, unknown>[]);
}

async function countRows(tableName?: string) {
  if (tableName) {
    const result = await sql.unsafe(`SELECT COUNT(*) as count FROM "${tableName}"`);
    console.log(`${tableName}: ${result[0].count} rows`);
  } else {
    // 全テーブルのカウント
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    for (const t of tables) {
      const name = t.table_name as string;
      const result = await sql.unsafe(`SELECT COUNT(*) as count FROM "${name}"`);
      console.log(`${name}: ${result[0].count} rows`);
    }
  }
}

/** seq scan で多く読まれている表(index を足すか cache の宣言にする材料)。統計を読むだけ */
async function listSeqScans(minRows: number | undefined, json: boolean) {
  const [reset] = await sql`SELECT stats_reset FROM pg_stat_database WHERE datname = current_database()`;
  const stats = (await sql`
    SELECT relname AS "table",
           n_live_tup AS live_rows,
           seq_scan,
           seq_tup_read AS seq_rows_read,
           COALESCE(idx_scan, 0) AS idx_scan
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
  `) as unknown as SeqScanStatRow[];
  const rows = seqScanRows(stats, { minRows });
  if (json) {
    console.log(rowsAsJson(rows));
    return;
  }
  const since = reset?.stats_reset ? new Date(reset.stats_reset as string).toISOString() : "不明";
  console.log(`統計の始まり: ${since}(Neon は compute の停止・再起動で統計が消える。数はその後の分)`);
  console.log(
    `表: 生きている行 ${minRows ?? SEQ_SCAN_DEFAULT_MIN_ROWS} 以上、seq scan で読んだ行の多い順。flagged = seq scan が index scan より多く、1 回で ${SEQ_SCAN_FLAG_ROWS} 行以上を読む(index か cache の宣言を考える)\n`,
  );
  printTable(rows.map((row) => ({ ...row, flagged: row.flagged ? "yes" : "" })));
}

async function main() {
  const { args: withoutJson, json } = splitJsonFlag(process.argv.slice(2));
  const { args, minRows } = splitMinRows(withoutJson);
  const command = args[0] as Command;
  const param = args.slice(1).join(" ");

  switch (command) {
    case "query":
      if (!param) {
        console.error("使用法: pnpm ops db inspect query \"SELECT * FROM table_name\"");
        process.exit(1);
      }
      await runQuery(param, json);
      break;

    case "tables":
      await listTables();
      break;

    case "describe":
      if (!param) {
        console.error("使用法: pnpm ops db inspect describe <table_name>");
        process.exit(1);
      }
      await describeTable(param);
      break;

    case "count":
      await countRows(param || undefined);
      break;

    case "seqscans":
      await listSeqScans(minRows, json);
      break;

    default:
      console.log(`
データベースCLIツール

使用法:
  pnpm ops db inspect query "SQL文" [--json]  SQLクエリを実行(--json = 行を JSON の配列で)
  pnpm ops db inspect tables            テーブル一覧を表示
  pnpm ops db inspect describe <table>  テーブル構造を表示
  pnpm ops db inspect count [table]     行数を表示（テーブル省略で全テーブル）
  pnpm ops db inspect seqscans [--min-rows=<n>] [--json]  seq scan で多く読まれている表(読むだけ、既定 1000 行以上の表)

例:
  pnpm ops db inspect query "SELECT * FROM users LIMIT 5"
  pnpm ops db inspect describe users
  pnpm ops db inspect count users
`);
      process.exit(1);
  }

  await sql.end();
}

main().catch((error) => {
  console.error("エラー:", error);
  process.exit(1);
});
