// scripts/runner/task/invocation.ts
// pnpm task の引数を「何をするか」と「実行の記録を書くか」に直す(純関数。run.ts が使い、テストが確かめる)。
// 記録を書く = 名指しの 1 回(ドメインのタスク・移行・人が名前を打った定期タスク、L1.31)だけ。
// --due(毎分の自動の回し)・--list・--resolve は記録を書かない(--resolve は既存の行を書き直す)。

export type Invocation =
  | { kind: "list"; usage: boolean; recorded: false }
  | { kind: "due"; recorded: false }
  | { kind: "resolve"; rest: string[]; recorded: false }
  | { kind: "named"; name: string; rest: string[]; recorded: true };

/** args = process.argv.slice(2) から "--" を除いた物 */
export function invocationOf(args: readonly string[]): Invocation {
  const [first, ...rest] = args;
  if (!first) return { kind: "list", usage: true, recorded: false };
  if (first === "--list" || first === "-l") return { kind: "list", usage: false, recorded: false };
  if (first === "--due") return { kind: "due", recorded: false };
  if (first === "--resolve") return { kind: "resolve", rest, recorded: false };
  return { kind: "named", name: first, rest, recorded: true };
}
