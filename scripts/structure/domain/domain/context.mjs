// 1 ドメイン分の「名前の全形 + domain.json」。生成器が使う名前はすべてここで一度だけ導出する。
//
// 入力のドメイン名は snake_case / camelCase / PascalCase のどれでもよい（フォルダ名 = camelCase(singular) が前提）。
// plural は domain.json の plural（無ければ src/lib/districtMap/domainNames.mjs の toPlural で推定）、dbEngine は domain.json の dbEngine（引数で上書き可）。

import { toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from "../../../../src/utils/stringCase.mjs";
import { camelPluralOf } from "../../../../src/lib/districtMap/domainNames.mjs";
import { toPlural } from "./plural.mjs";

/**
 * @typedef {object} DomainContext
 * @property {string} input      渡されたドメイン名そのまま
 * @property {string} snake      snake_case（表名・FK 名の元）
 * @property {string} camel      camelCase（フォルダ名・import パス・変数名）
 * @property {string} pascal     PascalCase（型名・コンポーネント名）
 * @property {string} camelPlural  複数形 camelCase（hooks の一覧名・管理画面）
 * @property {string} pascalPlural 複数形 PascalCase
 * @property {string} kebab      kebab-case
 * @property {string} kebabPlural  複数形 kebab-case（管理画面ルートのフォルダ名）
 * @property {string} label      表示名（domain.json の label、無ければ pascal）
 * @property {string} pluralRaw  domain.json の plural そのまま（Firestore のコレクション名）
 * @property {string} dbEngine   "Neon" | "Firestore" | ""
 * @property {object | null} config domain.json（無ければ null）
 * @property {"business" | "core"} kind business = src/features/<camel>、core = src/features/core/<camel>（違いはフォルダだけ）
 * @property {string} dir        ドメインのフォルダの絶対パス
 * @property {string} rel        ドメインのフォルダのリポジトリ相対（生成物の頭のコメントのパス。例: src/features/core/user）
 * @property {string} configPath domain.json の絶対パス
 */

/**
 * @param {import("./workspace.mjs").Workspace} workspace
 * @param {string} domainInput
 * @param {{ plural?: string, dbEngine?: string, config?: object | null }} [overrides] plural / dbEngine は domain.json より優先。config を渡すと読み直さない
 * @returns {DomainContext}
 */
export function createDomainContext(workspace, domainInput, overrides = {}) {
  const input = (domainInput || "").trim();
  const snake = toSnakeCase(input) || input;
  const camel = toCamelCase(snake) || snake;
  const pascal = toPascalCase(snake) || snake;
  const location = workspace.locateDomain(camel);
  const config = overrides.config !== undefined ? overrides.config : workspace.readConfig(camel);

  const pluralSource = overrides.plural || config?.plural || "";
  const camelPlural = camelPluralOf(camel, pluralSource);
  const pascalPlural = pluralSource ? toPascalCase(pluralSource) : toPlural(pascal);

  return {
    input,
    snake,
    camel,
    pascal,
    camelPlural,
    pascalPlural,
    kebab: toKebabCase(camel),
    kebabPlural: toKebabCase(camelPlural),
    label: config?.label ?? pascal,
    pluralRaw: config?.plural || overrides.plural || `${snake}s`,
    dbEngine: overrides.dbEngine || config?.dbEngine || "",
    config,
    kind: location.kind,
    dir: location.dir,
    rel: location.rel,
    configPath: location.configPath,
  };
}

/** domain.json が無いときに例外。生成器の入口で使う */
export function requireConfig(ctx) {
  if (!ctx.config) {
    throw new Error(`設定ファイルが見つかりません: ${ctx.configPath}`);
  }
  return ctx.config;
}

/** 生成物の頭のコメントに書くドメインのフォルダ（リポジトリ相対）。rel を持たない ctx（テストの手組み）は business の位置 */
export const featureRel = (ctx) => ctx.rel ?? `src/features/${ctx.camel}`;
