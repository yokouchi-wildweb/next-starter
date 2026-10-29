// 受け口の一覧(intake.txt)の読み取りと照合。Node 組み込みだけで動く純粋な .mjs
// 仕様: ./README.md「受け口の一覧」

import { matchesGlob } from "node:path";

export const INTAKE_KINDS = ["edit", "region", "marker", "append", "generated", "debt"];

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
