// 受け口の一覧(intake.txt)の読み取りと照合。Node 組み込みだけで動く純粋な .mjs
// 仕様: ./README.md「受け口の一覧」

import { matchesGlob } from "node:path";

export const INTAKE_KINDS = ["edit", "add", "region", "marker", "append", "generated", "debt"];

/** 受け口の一覧の置き場(リポジトリ直下からの相対) */
export const INTAKE_FILE = "src/lib/forkOwnership/intake.txt";
/** 受け口の行の生成区画(pnpm generate extensions が拡張点の宣言・1 行スイッチから書く。生成器の区画なので所有の検査の対象外: regions.mjs) */
export const INTAKE_BLOCK_START = "# === AUTO-GENERATED intake START ===";
export const INTAKE_BLOCK_END = "# === AUTO-GENERATED intake END ===";

/**
 * 一覧の生成区画の中身を rows に入れ替えたテキスト。印の対がちょうど 1 つでなければ { problem }
 * @param {string} text intake.txt の中身
 * @param {string[]} rows 区画に入れる行(印の行を除く)
 * @returns {{ text: string } | { problem: string }}
 */
export function replaceIntakeBlock(text, rows) {
  const lines = text.split("\n");
  const starts = lines.flatMap((line, i) => (line.trim() === INTAKE_BLOCK_START ? [i] : []));
  const ends = lines.flatMap((line, i) => (line.trim() === INTAKE_BLOCK_END ? [i] : []));
  if (starts.length !== 1 || ends.length !== 1 || ends[0] < starts[0]) {
    return { problem: `生成区画の印の対(${INTAKE_BLOCK_START} … ${INTAKE_BLOCK_END})がちょうど 1 つ要る` };
  }
  return { text: [...lines.slice(0, starts[0] + 1), ...rows, ...lines.slice(ends[0])].join("\n") };
}

/**
 * 受け口の一覧を読む。行番号は 1 始まり。
 * @returns {{ rules: { kind: string | null, glob: string, exclude: boolean, note: string, line: number }[], errors: { line: number, message: string }[] }}
 */
export function parseIntake(text) {
  const rules = [];
  const errors = [];
  text.split("\n").forEach((raw, index) => {
    const line = index + 1;
    const body = raw.replace(/\s+#.*$/, "").trim();
    if (body === "" || body.startsWith("#")) return;
    const note = raw.includes(" #") ? raw.slice(raw.indexOf(" #") + 2).trim() : "";

    if (body.startsWith("!")) {
      const glob = body.slice(1).trim();
      if (glob === "" || /\s/.test(glob)) {
        errors.push({ line, message: "除外の行は `!<glob>` の 1 語" });
        return;
      }
      rules.push({ kind: null, glob, exclude: true, note, line });
      return;
    }

    const parts = body.split(/\s+/);
    if (parts.length !== 2) {
      errors.push({ line, message: "書式は `<kind> <glob>  # 理由`" });
      return;
    }
    const [kind, glob] = parts;
    if (!INTAKE_KINDS.includes(kind)) {
      errors.push({ line, message: `kind は ${INTAKE_KINDS.join(" / ")} のどれか(${kind})` });
      return;
    }
    if (note === "") {
      errors.push({ line, message: "理由(`# …`)が無い" });
    }
    rules.push({ kind, glob, exclude: false, note, line });
  });
  return { rules, errors };
}

/**
 * パス(repo 相対、`/` 区切り)に効く規則。最後に当たった規則が効き、`!` の規則はそれまでの当たりを外す。
 * @returns {{ kind: string, glob: string, line: number } | null}
 */
export function matchIntake(rules, path) {
  let hit = null;
  for (const rule of rules) {
    if (!matchesGlob(path, rule.glob)) continue;
    hit = rule.exclude ? null : rule;
  }
  return hit;
}
