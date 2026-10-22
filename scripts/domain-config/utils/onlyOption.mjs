/**
 * dc:generate / dc:generate:all の `--only <category>[,<category>]` を扱う。
 *
 * `--only` は domain.json の generateFiles を上書きせず、true のカテゴリをさらに絞り込むだけ。
 * generateFiles で false にして手で編集しているファイルを、`--only` で上書きさせないため
 * （どの組み合わせで実行しても、指定なしより多くのファイルが書き換わることはない）。
 */

// 生成カテゴリ（domain.json generateFiles のキー）
export const GENERATE_CATEGORIES = [
  "entities",
  "components",
  "hooks",
  "clientServices",
  "serverServices",
  "fieldConstants",
  "adminRoutes",
  "registry",
  "presenters",
];

/**
 * 引数列から `--only <list>`（または `--only=<list>`）を取り出す。
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

/**
 * 生成カテゴリを `--only` で絞り込む。only が null なら gen をそのまま返す。
 * @param {Record<string, boolean>} gen 生成方法の選択結果（generateFiles 等）
 * @param {string[] | null} only
 * @returns {{ gen: Record<string, boolean>, skipped: string[] }} skipped = only に含まれるが gen で false のため生成しないカテゴリ
 */
export function narrowGenerateTargets(gen, only) {
  if (!only) return { gen, skipped: [] };
  const narrowed = Object.fromEntries(GENERATE_CATEGORIES.map((c) => [c, Boolean(gen[c]) && only.includes(c)]));
  const skipped = only.filter((c) => !gen[c]);
  return { gen: narrowed, skipped };
}
