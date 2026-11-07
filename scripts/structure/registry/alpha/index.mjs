// scripts/structure/registry/alpha/index.mjs
// src/registry の α 5 本(schemaRegistry・domainConfigRegistry・adminDataMenu・storagePurposeRegistry・adminDomains)を走査から丸ごと組み立てる(親 D67)。
// 字面で読むだけ(表の定義・サービスは import しない)。core も業務ドメインも同じ走査で、手書きの区画は無い。
// serviceRegistry は ../serviceRegistry/。コマンドの入口: ../generate.mjs・../check.mjs / 詳細: ../README.md

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { toCamelCase, toKebabCase, toSnakeCase } from "../../../../src/utils/stringCase.mjs";
import { FEATURES_DIR, scanFeatureTables } from "../tableScan.mjs";
import { domainDisplayPath, renderDomainDisplay } from "./domainDisplay.mjs";

export const SCHEMA_REGISTRY_FILE = "src/registry/schemaRegistry.ts";
export const DOMAIN_CONFIG_REGISTRY_FILE = "src/registry/domainConfigRegistry.ts";
export const ADMIN_DATA_MENU_FILE = "src/registry/adminDataMenu.ts";
export const STORAGE_PURPOSE_REGISTRY_FILE = "src/registry/storagePurposeRegistry.ts";
export const ADMIN_DOMAINS_FILE = "src/registry/adminDomains.ts";
/** ドメインの管理一覧の画面が置かれる route group(一覧 = <ここ>/<kebab 複数形>/page.tsx) */
export const ADMIN_LIST_ROUTE_DIR = "src/app/admin/(protected)";

const headerOf = (source) => `// 生成物・編集不可: pnpm generate registry が ${source} から生成する`;
const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** src/features の全 domain.json(path 順) */
function readDomains(repoRoot) {
  const found = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "domain.json") found.push(relative(repoRoot, full).split(sep).join("/"));
    }
  };
  walk(join(repoRoot, FEATURES_DIR));
  const problems = [];
  const domains = [];
  for (const file of found.sort(byString)) {
    const camel = file.split("/").at(-2);
    try {
      domains.push({ file, camel, config: JSON.parse(readFileSync(join(repoRoot, file), "utf8")) });
    } catch (error) {
      problems.push(`${file}: JSON として読めない(${error.message})`);
    }
  }
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
    headerOf(`${FEATURES_DIR}/**/domain.json`),
    `// ${DOMAIN_CONFIG_REGISTRY_FILE}`,
    "//",
    "// 全ドメインの domain.json の一覧(キー = フォルダ名の snake_case)。読み手: src/wiring/domainConfig.ts",
    "",
    'import "server-only";',
    "",
    'import type { DomainConfigOptionals } from "@/lib/domain/types/domainConfigOptionals";',
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

function renderAdminDataMenu(domains) {
  const items = domains
    .filter((d) => d.config.addToAdminDataMenu === true)
    .map((d) => `  { title: ${JSON.stringify(d.config.label ?? d.camel)}, href: ${JSON.stringify(`/admin/${toKebabCase(toCamelCase(d.config.plural ?? d.camel))}`)} },`);
  return [
    headerOf(`${FEATURES_DIR}/**/domain.json の addToAdminDataMenu`),
    `// ${ADMIN_DATA_MENU_FILE}`,
    "//",
    "// 管理画面「データ管理」のメニュー。ドメインを載せる = domain.json の addToAdminDataMenu: true。",
    "// それ以外の行(adminRoutes の無いドメインへの手書きのリンクなど)は src/config/ui/admin-global-menu.config.ts に書く。",
    "",
    "export const adminDataMenu: { title: string; href: string }[] = [",
    ...items,
    "];",
    "",
  ].join("\n");
}

/** ドメインの管理一覧の住所(adminDataMenu と同じ字面: /admin/<kebab 複数形>) */
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
    "// 出どころ dataMenu が addToAdminDataMenu: true の行を展開する(src/features/core/admin/menu/)。",
    "",
    "export const adminDomains = {",
    ...listed.map((d) => `  ${d.camel}: { label: ${JSON.stringify(d.config.label ?? d.camel)}, href: ${JSON.stringify(adminListHref(d))}, addToAdminDataMenu: ${d.config.addToAdminDataMenu === true} },`),
    "} as const satisfies Record<string, { label: string; href: string; addToAdminDataMenu: boolean }>;",
    "",
    "export type AdminDomainName = keyof typeof adminDomains;",
    "",
  ].join("\n");
}

/** src/features の全 services/server/storagePurposes.ts(path 順、ドメインの生成物か手書き) */
function readStoragePurposeFiles(repoRoot) {
  const found = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "storagePurposes.ts" && full.split(sep).slice(-3, -1).join("/") === "services/server") {
        found.push(relative(repoRoot, full).split(sep).join("/"));
      }
    }
  };
  walk(join(repoRoot, FEATURES_DIR));
  return found.sort(byString);
}

function renderStoragePurposeRegistry(repoRoot) {
  const files = readStoragePurposeFiles(repoRoot);
  const nameOf = (file) => `${file.split("/").at(-4)}Purposes`;
  return [
    headerOf(`${FEATURES_DIR}/**/services/server/storagePurposes.ts`),
    `// ${STORAGE_PURPOSE_REGISTRY_FILE}`,
    "//",
    "// ドメインのファイル用途の一覧。core と fork の項目は features/core/storageObject/purposes/、合成は storageObject/services/server/purposeSource.ts。型と規則: src/lib/storage/README.md",
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
 * α 5 本の中身を組み立てる
 * @param {string} repoRoot
 * @returns {{ outputs: Record<string, string>, problems: string[] }}
 */
export function buildAlphaRegistries(repoRoot) {
  const { domains, problems: domainProblems } = readDomains(repoRoot);
  const schema = renderSchemaRegistry(repoRoot);
  return {
    outputs: {
      [SCHEMA_REGISTRY_FILE]: schema.text,
      [DOMAIN_CONFIG_REGISTRY_FILE]: renderDomainConfigRegistry(domains),
      [ADMIN_DATA_MENU_FILE]: renderAdminDataMenu(domains),
      ...Object.fromEntries(domains.map(({ file, config }) => [domainDisplayPath(file), renderDomainDisplay(file, config, domains.map((domain) => domain.config))])),
      [STORAGE_PURPOSE_REGISTRY_FILE]: renderStoragePurposeRegistry(repoRoot),
      [ADMIN_DOMAINS_FILE]: renderAdminDomains(repoRoot, domains),
    },
    problems: [...domainProblems, ...schema.problems],
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
