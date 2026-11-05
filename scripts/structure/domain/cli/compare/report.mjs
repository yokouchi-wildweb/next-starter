// dc:compare の出力: ドメインごとに 1〜2 行の要約と見込み、--detail でファイルごと、最後に見込みの内訳

import { VERDICTS } from "./classify.mjs";

const KIND_LABEL = { untouched: "未改変", hand: "手の変更の見込み", stale: "古い生成物の見込み", new: "新しく作られる", keep: "残る（write-once）" };

function summaryLine(s) {
  const parts = [`未改変 ${s.untouched}${s.upstreamChanges ? `（うち上流の改良で変わる ${s.upstreamChanges}）` : ""}`];
  if (s.hand.files) parts.push(`手の変更の見込み ${s.hand.files} ファイル（+${s.hand.added} -${s.hand.removed}、${s.hand.hunks} か所）`);
  if (s.stale) parts.push(`古い生成物の見込み ${s.stale}`);
  if (s.keep) parts.push(`残る ${s.keep}`);
  if (s.newFiles) parts.push(`新しく作られる ${s.newFiles}`);
  if (s.forkFiles || s.wrapperFiles) parts.push(`fork のファイル ${s.forkFiles}${s.wrapperFiles ? `・wrappers ${s.wrapperFiles}` : ""}`);
  if (s.tableRewrite) parts.push("表の定義の書き直しあり（db:push:check 0 を確かめる）");
  return parts.join("・");
}

/**
 * @param {{ base: string, legacy: boolean, results: { name: string, summary: object, files: object[], forkFiles: string[], wrapperFiles: string[] }[], detail: boolean }} report
 */
export function printReport({ base, legacy, results, detail }, io = console) {
  io.log(`dc:compare: base = ${base}（${legacy ? "generateFiles で読む生成器" : "generate の旗で読む生成器"}）、今 = 作業ツリーの生成器。${results.length} ドメイン`);
  io.log("（今のファイル ／ base の生成器の出力 ／ 今の生成器の出力。fork のリポには書きません）\n");
  for (const { name, summary: s, files, forkFiles, wrapperFiles } of results) {
    io.log(`${name}  [${s.verdict}]  ${summaryLine(s)}`);
    if (s.newEntries.length) io.log(`    新しい入口: ${s.newEntries.join(", ")}`);
    if (s.nowError) io.log(`    今の生成器で止まる: ${s.nowError}`);
    if (s.baseError) io.log(`    base の生成器で止まる（比べられない分は今の出力と比べた）: ${s.baseError}`);
    if (!detail) continue;
    for (const { path, result, lastCommit } of files) {
      const stats = result.stats ? ` +${result.stats.added} -${result.stats.removed} ${result.stats.hunks} か所` : "";
      const last = lastCommit ? `  ← 最後の commit: ${lastCommit}` : "";
      const flags = [result.upstreamChanges ? "上流の改良で変わる" : "", result.entry ? "入口" : "", result.tableRewrite ? "表の書き直し" : ""].filter(Boolean).join("・");
      io.log(`    ${KIND_LABEL[result.kind]}${stats}${flags ? `（${flags}）` : ""}  ${path}${last}`);
    }
    for (const f of forkFiles) io.log(`    fork のファイル  ${f}`);
    for (const f of wrapperFiles) io.log(`    wrappers  ${f}`);
  }
  const tally = VERDICTS.map((v) => `${v} ${results.filter((r) => r.summary.verdict === v).length}`).join(" / ");
  io.log(`\n見込み: ${tally}`);
  io.log("見方: true にできる = base の出力と同じ。確かめて true = 新しい管理画面・API の入口・表の書き直し・古い生成物の見込み（消した・置き換えただけの差）がある。");
  io.log("      wrappers へ移すか false = base の出力に行を挿したファイルがある（手の変更の見込み。--detail で場所と最後の commit）。直してから = 今の生成器で止まる");
}
