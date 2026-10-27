// dc:* コマンドの引数の解釈

import { GENERATE_CATEGORIES } from "../spec/categories.mjs";

/**
 * `pnpm dc:generate -- Sample` のように書くと pnpm は `--` をそのまま渡すため、
 * 単独の `--` を取り除いて `pnpm dc:generate Sample` と同じ引数列にする
 */
export function getCliArgs(argv = process.argv) {
  return argv.slice(2).filter((arg) => arg !== "--");
}

/**
 * 引数列から `--only <list>`（または `--only=<list>`）を取り出す
 * @param {string[]} args getCliArgs() の結果
 * @returns {{ only: string[] | null, rest: string[] }} only = 指定カテゴリ（未指定は null）、rest = `--only` とその値を除いた引数
 */
export function parseOnlyOption(args) {
  const rest = [];
  let raw = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--only") {
      raw = args[i + 1] ?? "";
      i++;
      continue;
    }
    if (arg.startsWith("--only=")) {
      raw = arg.slice("--only=".length);
      continue;
    }
    rest.push(arg);
  }
  if (raw === null) return { only: null, rest };

  const only = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (only.length === 0 || only.some((c) => c.startsWith("--"))) {
    throw new Error(`--only にカテゴリを指定してください（${GENERATE_CATEGORIES.join(", ")}）`);
  }
  const unknown = only.filter((c) => !GENERATE_CATEGORIES.includes(c));
  if (unknown.length > 0) {
    throw new Error(`--only に不明なカテゴリがあります: ${unknown.join(", ")}（使えるもの: ${GENERATE_CATEGORIES.join(", ")}）`);
  }
  return { only, rest };
}
