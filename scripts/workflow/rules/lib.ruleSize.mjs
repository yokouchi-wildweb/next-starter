// scripts/workflow/rules/lib.ruleSize.mjs
// 決まりのファイルの大きさを字数で測る部品(行数ではない。Claude Code の警告は 1 ファイルの字数だけ)。
// 線の値の正本は .claude/rules/core/design.md の size の節。ここはそれを検査の形にした物。
// 字数は JS の文字列長(UTF-16 単位)で数える。日本語と英語は 1 字 = 1。
// 作業の場面ごとに読み込まれる量は数えない・制限しない(場面の合計の物差しは廃止)。

export const MAX_LINE_CHARS = 400;

// 線: notify = 通して知らせる(null = 知らせない)/ fail = 止める。目標の字数は置かない
export const SIZE_LINES = {
  // Claude Code が 1 ファイルの警告を出す 40,000 字で止め、少し手前の 38,000 字で知らせる
  claudeMd: { notify: 38000, fail: 40000 },
  core: { notify: null, fail: 40000 },
  card: { notify: null, fail: 10000 },
  service: { notify: null, fail: 40000 },
};

export const charCount = (text) => text.length;

/** 線に対する判定: "ok" | "notify" | "fail" */
export function judgeSize(chars, line) {
  if (line.fail !== null && chars >= line.fail) return "fail";
  if (line.notify !== null && chars > line.notify) return "notify";
  return "ok";
}

/** 400 字を超える行: [{ line, length }] */
export function longLines(text, max = MAX_LINE_CHARS) {
  return text
    .split("\n")
    .map((t, i) => ({ line: i + 1, length: t.length }))
    .filter((item) => item.length > max);
}
