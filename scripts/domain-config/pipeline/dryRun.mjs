// --dry-run: Output を書かずに「何をどうするか」を一覧する。pipeline/apply.mjs と同じ判定を読み取りだけで行う

import fs from "node:fs";
import path from "node:path";

const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null);

/**
 * 1 つの Output が apply で何をするかを言う
 * @returns {{ action: "作成" | "上書き" | "変更なし" | "保持" | "移行" | "スキップ" | null, path: string | null }}
 */
export function describeOutput(out) {
  switch (out.kind) {
    case "log":
      return { action: null, path: null };
    case "dir":
      return { action: fs.existsSync(out.path) ? "変更なし" : "作成", path: path.join(out.path, out.keepFile ?? "") };
    case "file": {
      const existing = read(out.path);
      if (existing === null) return { action: "作成", path: out.path };
      return { action: existing === out.content ? "変更なし" : "上書き", path: out.path };
    }
    case "writeOnce": {
      const existing = read(out.path);
      if (existing === null) return { action: "作成", path: out.path };
      if (out.migrate?.test(existing)) return { action: "移行", path: out.path };
      return { action: "保持", path: out.path };
    }
    case "patch": {
      const existing = read(out.path);
      if (existing === null) return { action: "スキップ", path: out.path };
      const result = out.apply(existing) ?? {};
      const changed = typeof result.text === "string" && result.text !== existing;
      return { action: changed ? "上書き" : "変更なし", path: out.path };
    }
    default:
      return { action: null, path: null };
  }
}

/**
 * 一覧を出す（書かない）
 * @param {import("../render/output.mjs").Output[]} outputs
 * @param {{ rootDir: string }} workspace
 * @param {{ log: (message: string) => void }} io
 * @returns {Record<string, number>} 動作ごとの件数
 */
export function reportDryRun(outputs, workspace, io = console) {
  const counts = {};
  for (const out of outputs) {
    const { action, path: target } = describeOutput(out);
    if (!action) continue;
    counts[action] = (counts[action] ?? 0) + 1;
    io.log(`  [dry-run] ${action.padEnd(4, "　")} ${path.relative(workspace.rootDir, target)}`);
  }
  return counts;
}

/** 件数の 1 行まとめ（例: 作成 3 / 上書き 2 / 変更なし 40） */
export function summarizeDryRun(counts) {
  const order = ["作成", "上書き", "移行", "保持", "変更なし", "スキップ"];
  return order
    .filter((action) => counts[action])
    .map((action) => `${action} ${counts[action]}`)
    .join(" / ");
}
