// scripts/operations/db/lib.push.ts
//
// pnpm db:push(push.ts)の純粋な部品(push.ts は先頭で guard を通すので、テストはここを読む)。
// データ消失を伴う文(DROP / truncate / 型変更)を含む時の進み方:
//   --force → そのまま実行 / 端末(TTY)→ y/N で問う / TTY のない実行(エージェント・CI・< /dev/null)→ 問わずに中止
//   (y/N の問いは答えが来ず、開いた DB の接続のせいで終わらない。research fixedstop-move Q4)
// 中止の文は理由と、読んでよければ --force を付けて打ち直す形を出す(DB は変えない)。

/** データ消失を伴う時の次の一手: apply = 実行する / ask = y/N で問う / stop = 問わずに中止 */
export type DataLossStep = "apply" | "ask" | "stop";

/** データ消失の有無・--force・端末か → 次の一手(データ消失なしは apply) */
export const dataLossStep = ({ hasDataLoss, force, interactive }: { hasDataLoss: boolean; force: boolean; interactive: boolean }): DataLossStep => {
  if (!hasDataLoss || force) return "apply";
  return interactive ? "ask" : "stop";
};

/** --force を付けて打ち直す形(向き先が開発でなければ --env を付ける。守りの旗は守りが外した後なので向き先から作る) */
export const forceRetryCommand = (stage: string, rest: readonly string[]): string => {
  const args = [...(stage === "development" ? [] : ["--env", stage]), ...rest.filter((a) => a !== "--force"), "--force"];
  return `pnpm db:push -- ${args.join(" ")}`;
};

/** 非対話で中止した時の文(複数行) */
export const dataLossStopMessage = (stage: string, rest: readonly string[]): string =>
  [
    "",
    "注意: データ消失を伴う文を含みます。",
    "TTY のない実行なので問わずに中止しました。DB は変更していません。",
    `上の SQL を読んで実行してよければ --force を付けて打ち直す: ${forceRetryCommand(stage, rest)}`,
  ].join("\n");
