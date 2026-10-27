// 生成カテゴリ（domain.json generateFiles のキー）と、`--only` による絞り込み。
//
// `--only` は generateFiles を上書きせず、true のカテゴリをさらに絞り込むだけ。
// generateFiles で false にして手で編集しているファイルを `--only` で上書きさせないため
// （どの組み合わせで実行しても、指定なしより多くのファイルが書き換わることはない）。

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

/** 全カテゴリを true にした generateFiles（「すべてのファイルを生成」） */
export const ALL_GENERATE_OPTIONS = Object.fromEntries(GENERATE_CATEGORIES.map((category) => [category, true]));

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
