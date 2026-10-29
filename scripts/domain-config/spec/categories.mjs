// 生成カテゴリと、ドメインごとに生成するカテゴリの決め方（domain.json の generate）、`--only` による絞り込み。
//
// generate（省略 = true）: true = 全カテゴリ（集まりの従属は従属のカテゴリだけ）、false = 何も生成しない（手で管理）。
// 区分ごとの generateFiles は廃止（checks/required.mjs が止める）。
// `--only` = 今回はこのカテゴリだけ（保存しない）。generate: true は全カテゴリから絞る、generate: false でも名指しのカテゴリは書く、
// 集まりの従属は従属のカテゴリの内だけ（従属に無いカテゴリは名指ししても書かない）。

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

/** 全カテゴリを true にした選択（「すべてのファイルを生成」） */
export const ALL_GENERATE_OPTIONS = Object.fromEntries(GENERATE_CATEGORIES.map((category) => [category, true]));

/** 集まりの従属（主の mediaCollection が持つ子）が生成するカテゴリ。管理画面・hooks・client は作らない（主の画面から扱う） */
export const COLLECTION_CHILD_CATEGORIES = ["entities", "serverServices", "fieldConstants", "registry", "presenters"];

/**
 * domain.json の generate から、そのドメインで生成するカテゴリを決める
 * @param {object} config domain.json
 * @param {{ child?: boolean }} [options] child = 集まりの従属か
 * @returns {Record<string, boolean>}
 */
export function generateTargets(config, { child = false } = {}) {
  const on = config?.generate === false ? [] : child ? COLLECTION_CHILD_CATEGORIES : GENERATE_CATEGORIES;
  return Object.fromEntries(GENERATE_CATEGORIES.map((category) => [category, on.includes(category)]));
}

/**
 * 生成カテゴリを `--only` で絞り込む。only が null なら gen をそのまま返す。
 * @param {Record<string, boolean>} gen 生成するカテゴリ（generateTargets か手動選択）
 * @param {string[] | null} only
 * @returns {{ gen: Record<string, boolean>, skipped: string[] }} skipped = only に含まれるが gen で false のため生成しないカテゴリ
 */
export function narrowGenerateTargets(gen, only) {
  if (!only) return { gen, skipped: [] };
  const narrowed = Object.fromEntries(GENERATE_CATEGORIES.map((c) => [c, Boolean(gen[c]) && only.includes(c)]));
  const skipped = only.filter((c) => !gen[c]);
  return { gen: narrowed, skipped };
}
