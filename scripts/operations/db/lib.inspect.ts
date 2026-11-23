// scripts/operations/db/lib.inspect.ts
//
// pnpm ops db inspect の純粋な部品(inspect.ts は先頭で guard を通すので、テストはここを読む)。
// - splitJsonFlag: 引数から --json を外す(query の SQL に混ぜない)
// - rowsAsJson: 行を JSON の配列 1 つにする(機械が読む形。表の出力は今のまま)

/** 引数から --json を外し、残りと旗を返す */
export const splitJsonFlag = (args: readonly string[]): { args: string[]; json: boolean } => ({
  args: args.filter((a) => a !== "--json"),
  json: args.includes("--json"),
});

/** 行を JSON の配列 1 つ(1 行)にする。Date は ISO の文字列、bigint は文字列 */
export const rowsAsJson = (rows: readonly Record<string, unknown>[]): string =>
  JSON.stringify(rows, (_key, value) => (typeof value === "bigint" ? value.toString() : value));

/** pg_stat_user_tables の 1 行(seqscans が読む欄。数は postgres の bigint が文字列で来ることがある) */
export type SeqScanStatRow = {
  table: string;
  live_rows: number | string | null;
  seq_scan: number | string | null;
  seq_rows_read: number | string | null;
  idx_scan: number | string | null;
};

/** seqscans の 1 行(読んだ行の多い順に並べ、印を付けた物) */
export type SeqScanRow = {
  table: string;
  live_rows: number;
  seq_scan: number;
  seq_rows_read: number;
  idx_scan: number;
  /** 1 回の seq scan で読む行の平均(seq_scan 0 なら 0) */
  rows_per_seq_scan: number;
  /** seq scan が index scan より多く、1 回で読む行が多い(index か cache の宣言を考える表) */
  flagged: boolean;
};

/** 印の線: 1 回の seq scan で読む行の平均がこれ以上 */
export const SEQ_SCAN_FLAG_ROWS = 1000;
/** 既定で出す表の大きさ(生きている行の数)の下限 */
export const SEQ_SCAN_DEFAULT_MIN_ROWS = 1000;

const toCount = (value: number | string | null): number => {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** 統計の行 → 小さな表を外し、読んだ行の多い順、印つき */
export function seqScanRows(rows: readonly SeqScanStatRow[], options: { minRows?: number } = {}): SeqScanRow[] {
  const minRows = options.minRows ?? SEQ_SCAN_DEFAULT_MIN_ROWS;
  return rows
    .map((row) => {
      const seqScan = toCount(row.seq_scan);
      const seqRowsRead = toCount(row.seq_rows_read);
      const idxScan = toCount(row.idx_scan);
      const rowsPerSeqScan = seqScan > 0 ? Math.round(seqRowsRead / seqScan) : 0;
      return {
        table: row.table,
        live_rows: toCount(row.live_rows),
        seq_scan: seqScan,
        seq_rows_read: seqRowsRead,
        idx_scan: idxScan,
        rows_per_seq_scan: rowsPerSeqScan,
        flagged: seqScan > idxScan && rowsPerSeqScan >= SEQ_SCAN_FLAG_ROWS,
      };
    })
    .filter((row) => row.live_rows >= minRows)
    .sort((a, b) => b.seq_rows_read - a.seq_rows_read || a.table.localeCompare(b.table));
}

/** `--min-rows=<n>` を外して数にする(無ければ undefined、正の整数でなければ throw) */
export function splitMinRows(args: readonly string[]): { args: string[]; minRows: number | undefined } {
  let minRows: number | undefined;
  const rest = args.filter((arg) => {
    const m = /^--min-rows=(.*)$/.exec(arg);
    if (!m) return true;
    const n = Number(m[1]);
    if (!Number.isInteger(n) || n < 0) throw new Error(`--min-rows は 0 以上の整数(今: ${m[1]})`);
    minRows = n;
    return false;
  });
  return { args: rest, minRows };
}
