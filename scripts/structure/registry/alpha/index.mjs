// scripts/structure/registry/alpha/index.mjs
// src/registry の α(schemaRegistry・domainConfigRegistry・storagePurposeRegistry・adminDomains・messageRegistry・recordTargetRegistry)を走査から丸ごと組み立てる(親 D67)。
// 字面で読むだけ(表の定義・サービスは import しない)。core も業務ドメインも同じ走査で、手書きの区画は無い。
// serviceRegistry は ../serviceRegistry/。コマンドの入口: ../generate.mjs・../check.mjs / 詳細: ../README.md

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readDistrictMapAt } from "../../../../src/lib/districtMap/node.mjs";
import { ENTITIES_DIR, ENTITY_DECLARATION_FILE, listDomains as listDeclaredDomains, nodeDomainSource, primaryRegistrationOf, readDomains as readDeclaredDomains } from "../../../../src/lib/domain/node.mjs";
import { toCamelCase, toKebabCase, toSnakeCase } from "../../../../src/lib/stringCase/index.mjs";
import { FEATURES_DIR, scanFeatureTables } from "../tableScan.mjs";
import { domainDisplayPath, renderDomainDisplay } from "./domainDisplay.mjs";
import { MESSAGE_REGISTRY_FILE, renderMessageRegistry } from "./messageRegistry.mjs";
import { RECORD_TARGET_REGISTRY_FILE, renderRecordTargetRegistry } from "./recordTargetRegistry.mjs";

export { MESSAGE_REGISTRY_FILE } from "./messageRegistry.mjs";
export { RECORD_TARGET_REGISTRY_FILE } from "./recordTargetRegistry.mjs";

export const SCHEMA_REGISTRY_FILE = "src/registry/schemaRegistry.ts";
export const DOMAIN_CONFIG_REGISTRY_FILE = "src/registry/domainConfigRegistry.ts";
export const STORAGE_PURPOSE_REGISTRY_FILE = "src/registry/storagePurposeRegistry.ts";
export const ADMIN_DOMAINS_FILE = "src/registry/adminDomains.ts";
/** ドメインの管理一覧の画面が置かれる route group(一覧 = <ここ>/<kebab 複数形>/page.tsx) */
export const ADMIN_LIST_ROUTE_DIR = "src/app/admin/(protected)";

const headerOf = (source) => `// 生成物・編集不可: pnpm generate registry が ${source} から生成する`;
const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * 宣言のあるドメインの主の登録(登録名 = ドメイン名か、登録 1 つ)の entity.json(path 順)。読むのは宣言の読み込みの部品 readDomain だけ(D335)。
 * 主の登録の無いドメイン(表なし・ドメイン名でない登録が複数)は並べない
 */
function readDomains(repoRoot) {
  const source = nodeDomainSource(repoRoot);
  // 業務と core の同じフォルダ名は登録のキーが同じになる(readDomains は名前で 1 つにまとめるので、一覧から見る)
  const listed = listDeclaredDomains(source).domains;
  const problems = listed
    .filter((domain) => !domain.core && listed.some((other) => other.core && other.name === domain.name))
    .map((domain) => `${domain.dir}/${ENTITIES_DIR}/${domain.name}/${ENTITY_DECLARATION_FILE}: フォルダ名 ${domain.name} が src/domains/core/${domain.name} と重なる(登録のキーが同じになる)`);
  const domains = [];
  for (const declaration of readDeclaredDomains(source)) {
    if (declaration.domain === null) continue;
    problems.push(...declaration.problems.filter((problem) => problem.includes("JSON として読めない")));
    const registration = primaryRegistrationOf(declaration);
    if (!registration?.entity) continue;
    // 表示名はドメインの宣言 domain.json の label(管理の一覧・データ操作の一覧の名前、D335)
    domains.push({ file: `${registration.dir}/${ENTITY_DECLARATION_FILE}`, camel: declaration.name, label: declaration.domain.label ?? registration.entity.label ?? declaration.name, config: registration.entity });
  }
  domains.sort((a, b) => byString(a.file, b.file));
  const seen = new Map();
  for (const domain of domains) {
    if (seen.has(domain.camel)) problems.push(`${domain.file}: フォルダ名 ${domain.camel} が ${seen.get(domain.camel)} と重なる(登録のキーが同じになる)`);
    seen.set(domain.camel, domain.file);
  }
  return { domains, problems };
}

function renderSchemaRegistry(repoRoot) {
  const { tables, problems } = scanFeatureTables(repoRoot);
  const files = [...new Set(tables.map((t) => t.file))].sort(byString);
  const lines = [
    headerOf(`${FEATURES_DIR}/** の pgTable`),
    `// ${SCHEMA_REGISTRY_FILE}`,
    "//",
    "// db:push の唯一のスキーマ入口。pgTable を持つファイルを走査して全部並べる(足し忘れが起きない)。",
    "// 機能を閉じたときに外す表は 門番 src/featureGate/node/gatedSchema.ts(@/featureGate/node の gatedSchema)が別に見る。検査: pnpm check registry / pnpm test scripts/structure/registry",
    "",
    ...files.map((f) => `export * from "@/${f.slice("src/".length).replace(/\.tsx?$/, "")}";`),
    "",
    "export {};",
    "",
  ];
  return { text: lines.join("\n"), problems };
}

function renderDomainConfigRegistry(domains) {
  const lines = [
    headerOf(`${FEATURES_DIR}/**/entities/*/entity.json`),
    `// ${DOMAIN_CONFIG_REGISTRY_FILE}`,
    "//",
    "// 全ドメインの主の登録の宣言 entity.json の一覧(キー = フォルダ名の snake_case)。読み手: src/wiring/domainConfig.ts",
    "",
    'import "server-only";',
    "",
    'import type { DomainConfigOptionals } from "@/lib/domain";',
    "",
    ...domains.map((d) => `import ${d.camel}Config from "@/${d.file.slice("src/".length)}";`),
    "",
    "export const domainConfigMap = {",
    ...domains.map((d) => `  ${toSnakeCase(d.camel)}: ${d.camel}Config,`),
    "} as const;",
    "",
    "export type DomainKey = keyof typeof domainConfigMap;",
    "",
    "export type DomainConfig = (typeof domainConfigMap)[DomainKey] & DomainConfigOptionals;",
    "",
  ];
  return lines.join("\n");
}

/** ドメインの管理一覧の住所(/admin/<kebab 複数形>。pnpm generate domain の adminRoutes と同じ字面) */
const adminListHref = (d) => `/admin/${toKebabCase(toCamelCase(d.config.plural ?? d.camel))}`;

/**
 * 管理一覧の画面を持つ全ドメイン(generate: false も含む)のキー付き一覧。キー = ドメインのフォルダ名(camelCase)。
 * 画面を持つ = ADMIN_LIST_ROUTE_DIR/<kebab 複数形>/page.tsx がある(domain.json に印は無い)。管理メニューの項目 domain:"<名前>" と出どころ dataMenu が読む
 */
function renderAdminDomains(repoRoot, domains) {
  const listed = domains.filter((d) => existsSync(join(repoRoot, ADMIN_LIST_ROUTE_DIR, adminListHref(d).slice("/admin/".length), "page.tsx")));
  return [
    headerOf(`${FEATURES_DIR}/**/domain.json と ${ADMIN_LIST_ROUTE_DIR}/<kebab 複数形>/page.tsx`),
    `// ${ADMIN_DOMAINS_FILE}`,
    "//",
    "// 管理一覧の画面を持つドメインの一覧(キー = フォルダ名)。管理メニューの項目 domain:\"<名前>\" が題名と住所を引き、",
    "// 出どころ dataMenu が addToAdminDataMenu: true の行を展開する(src/domains/core/admin/menu/)。",
    "",
    "export const adminDomains = {",
    ...listed.map((d) => `  ${d.camel}: { label: ${JSON.stringify(d.label)}, href: ${JSON.stringify(adminListHref(d))}, addToAdminDataMenu: ${d.config.addToAdminDataMenu === true} },`),
    "} as const satisfies Record<string, { label: string; href: string; addToAdminDataMenu: boolean }>;",
    "",
    "export type AdminDomainName = keyof typeof adminDomains;",
    "",
  ].join("\n");
}

/** domains の地区の services/server/storagePurposes.ts(path 順、ドメインの生成物か手書き)。地区の見つけ方は src/lib/districtMap */
function readStoragePurposeFiles(repoRoot) {
  return readDistrictMapAt(repoRoot)
    .districts.filter((district) => district.kind === "domains")
    .map((district) => `${district.dir}/services/server/storagePurposes.ts`)
    .filter((file) => existsSync(join(repoRoot, file)))
    .sort(byString);
}

function renderStoragePurposeRegistry(repoRoot) {
  const files = readStoragePurposeFiles(repoRoot);
  const nameOf = (file) => `${file.split("/").at(-4)}Purposes`;
  return [
    headerOf(`${FEATURES_DIR}/**/services/server/storagePurposes.ts`),
    `// ${STORAGE_PURPOSE_REGISTRY_FILE}`,
    "//",
    "// ドメインのファイル用途の一覧。core と fork の項目は <ドメイン>/plugs/storageObjectPurposes/、合成は storageObject/services/server/purposeSource.ts。型と規則: src/lib/storage/README.md",
    "",
    'import "server-only";',
    "",
    'import type { StoragePurposeMap } from "@/lib/storage";',
    "",
    ...files.map((f) => `import { purposes as ${nameOf(f)} } from "@/${f.slice("src/".length).replace(/\.ts$/, "")}";`),
    "",
    "export const storagePurposeRegistry: StoragePurposeMap[] = [",
    ...files.map((f) => `  ${nameOf(f)},`),
    "];",
    "",
  ].join("\n");
}

/**
 * α 4 本の中身を組み立てる
 * @param {string} repoRoot
 * @returns {{ outputs: Record<string, string>, problems: string[] }}
 */
export function buildAlphaRegistries(repoRoot) {
  const { domains, problems: domainProblems } = readDomains(repoRoot);
  const schema = renderSchemaRegistry(repoRoot);
  const messages = renderMessageRegistry(repoRoot);
  const recordTargets = renderRecordTargetRegistry(repoRoot);
  return {
    outputs: {
      [SCHEMA_REGISTRY_FILE]: schema.text,
      [DOMAIN_CONFIG_REGISTRY_FILE]: renderDomainConfigRegistry(domains),
      ...Object.fromEntries(domains.map(({ file, config }) => [domainDisplayPath(file), renderDomainDisplay(file, config, domains.map((domain) => domain.config))])),
      [STORAGE_PURPOSE_REGISTRY_FILE]: renderStoragePurposeRegistry(repoRoot),
      [ADMIN_DOMAINS_FILE]: renderAdminDomains(repoRoot, domains),
      [MESSAGE_REGISTRY_FILE]: messages.text,
      [RECORD_TARGET_REGISTRY_FILE]: recordTargets.text,
    },
    problems: [...domainProblems, ...schema.problems, ...messages.problems, ...recordTargets.problems],
  };
}

/** 生成結果と今のファイルのずれ(空 = 一致) */
export function staleAlphaRegistries(repoRoot, outputs) {
  return Object.entries(outputs)
    .filter(([path, text]) => {
      const abs = join(repoRoot, path);
      return !existsSync(abs) || readFileSync(abs, "utf8") !== text;
    })
    .map(([path]) => path);
}
