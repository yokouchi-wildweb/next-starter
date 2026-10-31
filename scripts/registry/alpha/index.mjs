// scripts/registry/alpha/index.mjs
// src/registry の α 3 本(schemaRegistry・domainConfigRegistry・adminDataMenu)を走査から丸ごと組み立てる(親 D67)。
// 字面で読むだけ(表の定義・サービスは import しない)。core も業務ドメインも同じ走査で、手書きの区画は無い。
// serviceRegistry は ../serviceRegistry/。コマンドの入口: ../generate.mjs・../check.mjs / 詳細: ../README.md
//
// dc:generate は今もこの 3 本に行を足す(field-type の legate が外すまで)。足す行の字面と置き先
// (`export {};` の前・`} as const` の前・最後の行の前)を壊さない形で出すが、並びは違うので registry:check が止める。

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { toCamelCase, toKebabCase, toSnakeCase } from "../../../src/utils/stringCase.mjs";
import { FEATURES_DIR, scanFeatureTables } from "../tableScan.mjs";
import { domainDisplayPath, renderDomainDisplay } from "./domainDisplay.mjs";

export const SCHEMA_REGISTRY_FILE = "src/registry/schemaRegistry.ts";
export const DOMAIN_CONFIG_REGISTRY_FILE = "src/registry/domainConfigRegistry.ts";
export const ADMIN_DATA_MENU_FILE = "src/registry/adminDataMenu.ts";

/** ロール・プロフィールの生成物は今の場所の一覧を通す(L1.10)。一覧の移設は field-type の legate */
const PROFILE_GENERATED_PREFIX = `${FEATURES_DIR}/core/userProfile/generated/`;
const PROFILE_TABLE_REGISTRY = "@/registry/profileTableRegistry";

const headerOf = (source) => `// 生成物・編集不可: pnpm registry:generate が ${source} から生成する`;
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
  const files = [...new Set(tables.map((t) => t.file))].filter((f) => !f.startsWith(PROFILE_GENERATED_PREFIX)).sort(byString);
  const lines = [
    headerOf(`${FEATURES_DIR}/** の pgTable`),
    `// ${SCHEMA_REGISTRY_FILE}`,
    "//",
    "// db:push の唯一のスキーマ入口。pgTable を持つファイルを走査して全部並べる(足し忘れが起きない)。",
    "// 機能を閉じたときに外す表は scripts/registry/schemaGate.ts が別に見る。検査: pnpm registry:check / pnpm test:schema-registry",
    "",
    `export * from "${PROFILE_TABLE_REGISTRY}";`,
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

/**
 * α 3 本の中身を組み立てる
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
