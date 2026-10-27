// src/lib/domain/relations/relationOptions.mjs
// domain.json の relations から「フォームに出る関連」「選択肢を全件取得する関連」を判定し、
// その選択肢の SWR キーを組み立てる純粋関数。
//
// 使う側(3 者が同じ判定を共有する。ここ以外に同じ判定を書かない):
//   - クライアント: src/lib/domain/hooks/useRelationOptions.ts(選択肢の取得と FieldConfig 生成)
//   - サーバー:     src/features/core/admin/services/server/loaders/adminRelationOptions.ts(SSR 先読み → SWR fallback)
//   - 生成器:       scripts/domain-config/render/{adminRoutes/relationTokens.mjs, components/fields.mjs}
// .mjs なのは、tsx を通さない生成器(node)からも TypeScript からも import できるようにするため(src/utils/stringCase.mjs と同じ)。

/** ユーザー入力時に非同期検索する formInput(選択肢を全件取得しない) */
const ASYNC_FORM_INPUTS = new Set(["asyncCombobox", "asyncMultiSelect"]);

/** SWR キーの接頭辞。useRelationOptions と SSR fallback が同じキーを使う */
export const RELATION_OPTIONS_KEY_PREFIX = "relationOptions";

/**
 * @typedef {object} RelationOptionsRelation
 * @property {string} domain 関連先ドメイン名(domain.json の表記、通常 snake_case)
 * @property {string} relationType "belongsTo" | "belongsToMany" | "hasMany" | "hasOne"
 * @property {string} [formInput] フォーム入力種別(省略時 belongsTo→select, belongsToMany→checkbox)
 * @property {boolean} [includeRelationTable] belongsToMany で中間テーブルを持つ側か(false = 逆側、フォームに出ない)
 */

/**
 * @typedef {object} RelationOptionsConfig
 * @property {RelationOptionsRelation[]} [relations]
 */

/** @param {string | undefined} formInput */
export function isAsyncRelationFormInput(formInput) {
  return formInput != null && ASYNC_FORM_INPUTS.has(formInput);
}

/** @param {string | undefined} formInput */
export function isCustomRelationFormInput(formInput) {
  return formInput === "custom";
}

/**
 * フォームに入力欄として出る関連: belongsTo と、中間テーブルを持つ側の belongsToMany。
 * hasMany / hasOne と、includeRelationTable: false の belongsToMany(逆側)は出ない。
 * @param {RelationOptionsConfig} config
 * @returns {RelationOptionsRelation[]}
 */
export function getFormRelations(config) {
  return (config?.relations ?? []).filter((rel) => {
    if (rel.relationType === "belongsTo") return true;
    if (rel.relationType === "belongsToMany") return rel.includeRelationTable !== false;
    return false;
  });
}

/**
 * 選択肢を全件取得する関連: フォームに出る関連のうち、async(入力側が自分で検索する)と custom(UI を自作する)を除いたもの。
 * SSR の先読みもクライアントの取得もこの一覧だけを対象にする。
 * @param {RelationOptionsConfig} config
 * @returns {RelationOptionsRelation[]}
 */
export function getStaticRelations(config) {
  return getFormRelations(config).filter(
    (rel) => !isAsyncRelationFormInput(rel.formInput) && !isCustomRelationFormInput(rel.formInput),
  );
}

/**
 * 全件取得する関連の選択肢の SWR キー。関連が無ければ null(useSWR に渡すと取得しない)。
 * 文字列キーにしてあるので、SWRConfig の fallback にそのまま使える(配列キーの直列化が要らない)。
 * @param {RelationOptionsRelation[]} staticRelations getStaticRelations の結果
 * @returns {string | null}
 */
export function relationOptionsKey(staticRelations) {
  if (staticRelations.length === 0) return null;
  return `${RELATION_OPTIONS_KEY_PREFIX}:${staticRelations.map((rel) => rel.domain).join(",")}`;
}

/**
 * SWR キーから関連先ドメイン名の一覧を取り出す(relationOptionsKey の逆)。
 * @param {string} key
 * @returns {string[]}
 */
export function domainsFromRelationOptionsKey(key) {
  const prefix = `${RELATION_OPTIONS_KEY_PREFIX}:`;
  if (!key.startsWith(prefix)) return [];
  const rest = key.slice(prefix.length);
  return rest === "" ? [] : rest.split(",");
}
