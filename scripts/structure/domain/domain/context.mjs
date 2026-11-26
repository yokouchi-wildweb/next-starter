// 生成の単位 1 件(ドメインの中の登録 1 件、D336)の「名前の全形 + その登録の entity.json + ドメインの置き場」。生成器が使う名前はすべてここで一度だけ導出する。
// 名前(camel・pascal・複数形・kebab・label・config・configPath)は登録の物、置き場(kind・dir・rel・folder)はドメインの物。表 1 つのドメインは登録名 = ドメイン名で同じになる。
//
// 入力のドメイン名は snake_case / camelCase / PascalCase のどれでもよい（フォルダ名 = camelCase(singular) が前提）。
// plural は entity.json の plural（無ければ src/lib/districtMap/domainNames.mjs の toPlural で推定）、dbEngine は entity.json の dbEngine（引数で上書き可）。

import { toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from "../../../../src/lib/stringCase/index.mjs";
import { camelPluralOf } from "../../../../src/lib/districtMap/index.mjs";
import { toPlural } from "./plural.mjs";
import path from "node:path";
import { ENTITIES_DIR, ENTITY_DECLARATION_FILE } from "../../../../src/lib/domain/node.mjs";

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
 * @property {string} label      表示名（entity.json の label、無ければ pascal）
 * @property {string} pluralRaw  entity.json の plural そのまま（Firestore のコレクション名）
 * @property {string} dbEngine   "Neon" | "Firestore" | ""
 * @property {object | null} config 主の登録の entity.json（無ければ null）
 * @property {"business" | "core"} kind business = src/domains/<camel>、core = src/domains/core/<camel>（違いはフォルダだけ）
 * @property {string} dir        ドメインのフォルダの絶対パス
 * @property {string} rel        ドメインのフォルダのリポジトリ相対（生成物の頭のコメントのパス。例: src/domains/core/user）
 * @property {string} configPath 登録の entities/<camel>/entity.json の絶対パス
 * @property {string} folder     ドメインのフォルダ名(import の道 @/domains/<folder>/…。表 1 つのドメインは camel と同じ)
 * @property {string} domain     ドメインのフォルダ名(folder と同じ。生成の知らせの見出し)
 * @property {(registration: string) => string} importRootOf 登録の置き場の import の根(@/domains/<その登録のドメインのフォルダ>)
 * @property {boolean} firstUnit  ドメインの最初の生成の単位か(ドメインに 1 つの物 = seed.ts を書くのはこの単位だけ)
 */

/**
 * @param {import("./workspace.mjs").Workspace} workspace
 * @param {string} domainInput ドメインのフォルダ名
 * @param {{ plural?: string, dbEngine?: string, config?: object | null, registration?: string, firstUnit?: boolean }} [overrides] plural / dbEngine は entity.json より優先。config を渡すと読み直さない。
 *   registration = 生成する登録名(省略 = ドメインの主の登録、無ければドメイン名)、firstUnit = ドメインの最初の単位か(省略 = registration を渡さない時だけ)
 * @returns {DomainContext}
 */
export function createDomainContext(workspace, domainInput, overrides = {}) {
  const input = (domainInput || "").trim();
  const folderSnake = toSnakeCase(input) || input;
  const folder = toCamelCase(folderSnake) || folderSnake;
  const location = workspace.locateDomain(folder);
  const registration = overrides.registration ?? folder;
  const snake = toSnakeCase(registration) || registration;
  const camel = toCamelCase(snake) || snake;
  const pascal = toPascalCase(snake) || snake;
  const config =
    overrides.config !== undefined ? overrides.config : overrides.registration ? workspace.readRegistrationConfig(folder, camel) : workspace.readConfig(folder);

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
    configPath: path.join(location.dir, ENTITIES_DIR, camel, ENTITY_DECLARATION_FILE),
    folder,
    domain: folder,
    importRootOf: (name) => (name === camel ? `@/domains/${folder}` : workspace.importRootOf(name)),
    firstUnit: overrides.firstUnit ?? !overrides.registration,
  };
}

/** 主の登録の entity.json が無いときに例外。生成器の入口で使う */
export function requireConfig(ctx) {
  if (!ctx.config) {
    throw new Error(`設定ファイルが見つかりません: ${ctx.configPath}`);
  }
  return ctx.config;
}

/**
 * 登録の置き場の import の根(@/domains/<ドメインのフォルダ>)。自分の登録はドメインのフォルダ、他の登録はそのドメイン(関連の先 relations[].domain は登録名)。
 * importRootOf を持たない ctx(テストの手組み)は登録名のフォルダ
 * @param {Partial<DomainContext>} ctx
 * @param {string} [registration] 省略 = 自分の登録
 */
export const importRootFor = (ctx, registration = ctx.camel) =>
  registration === ctx.camel ? `@/domains/${ctx.folder ?? ctx.camel}` : (ctx.importRootOf?.(registration) ?? `@/domains/${registration}`);

/** 生成物の頭のコメントに書くドメインのフォルダ（リポジトリ相対）。rel を持たない ctx（テストの手組み）は business の位置 */
export const domainRel = (ctx) => ctx.rel ?? `src/domains/${ctx.camel}`;
