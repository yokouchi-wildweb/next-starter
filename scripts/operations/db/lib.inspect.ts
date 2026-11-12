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
