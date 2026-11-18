// scripts/workflow/rules/lib.ruleSize.mjs
// 決まりのファイルの大きさを字数で測る部品(行数ではない。Claude Code の警告は 1 ファイルの字数だけ)。
// 線の値と数え方の正本は .claude/rules/core/design.md の size の節。ここはそれを検査の形にした物。
// 字数は JS の文字列長(UTF-16 単位)で数える。日本語と英語は 1 字 = 1。
import { matchesGlob } from "node:path";
import { parsePaths } from "./lib.rulePaths.mjs";

export const MAX_LINE_CHARS = 400;

// 線: target = 設計の数(知らせない)/ notify = 通して知らせる / fail = 止める(null = 止めない)
export const SIZE_LINES = {
  // CLAUDE.md の失敗の線 36,000 は最後の切り替え(書き直しの出荷)で効かせる。今の版はそれを超えているので、それまでは知らせるだけ
  claudeMd: { target: 27000, notify: 34000, fail: null, failLater: 36000 },
  core: { target: 5000, notify: 9000, fail: 10000 },
  card: { target: 2000, notify: 2000, fail: null },
  service: { target: 5000, notify: 6000, fail: null },
  scene: { target: 24000, notify: 33000, fail: 36000 },
};

export const charCount = (text) => text.length;

/** 線に対する判定: "ok" | "notify" | "fail" */
export function judgeSize(chars, line) {
  if (line.fail !== null && chars >= line.fail) return "fail";
  if (chars > line.notify) return "notify";
  return "ok";
}

/** 400 字を超える行: [{ line, length }] */
export function longLines(text, max = MAX_LINE_CHARS) {
  return text
    .split("\n")
    .map((t, i) => ({ line: i + 1, length: t.length }))
    .filter((item) => item.length > max);
}

/** 場面のデータ(1 行 1 場面の JSON: { id, scene, files })を読む */
export function parseScenes(text) {
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l, i) => {
      const s = JSON.parse(l);
      if (!s.id || !s.scene || !Array.isArray(s.files) || s.files.length === 0) throw new Error(`scenes ${i + 1} 行目: id・scene・files が要る`);
      return s;
    });
}

/**
 * 場面ごとの合計: その場面のファイルのどれかに paths が当たる決まりのファイル(上流の core のファイルと札)の字数を足す
 * @param {{id:string, scene:string, files:string[]}[]} scenes
 * @param {{path:string, text:string}[]} rules 数える決まりのファイル(呼ぶ側が上流の物だけを渡す)
 * @returns {{id:string, scene:string, chars:number, loaded:string[]}[]}
 */
export function sceneTotals(scenes, rules) {
  const withPaths = rules.map((r) => ({ ...r, paths: parsePaths(r.text) ?? [] }));
  return scenes.map((s) => {
    const loaded = withPaths.filter((r) => r.paths.some((p) => s.files.some((f) => matchesGlob(f, p))));
    return { id: s.id, scene: s.scene, chars: loaded.reduce((n, r) => n + charCount(r.text), 0), loaded: loaded.map((r) => r.path) };
  });
}
