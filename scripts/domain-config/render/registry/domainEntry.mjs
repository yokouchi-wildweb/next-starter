// services/server/domainEntry.ts（毎回上書き）: domain.json の apiAccess / useImportExport から access を、表名と id 列を書く。
// src/registry/serviceRegistry.ts はこのファイルから pnpm registry:generate が作る（dc:generate の最後に自動で走る）

import path from "node:path";
import { domainTableName } from "../../domain/names.mjs";
import { file } from "../output.mjs";
import { ACCESS_PRESETS, PRESET_MODULE, serializeAccess } from "./presetAccess.mjs";

// fail-closed 既定（apiAccess 未宣言ドメイン用）。出力は ...ADMIN_ONLY になる
const FAIL_CLOSED_ACCESS = ACCESS_PRESETS.ADMIN_ONLY;

/**
 * domain.json から domainEntry.ts の access を組む。
 * - read / write = apiAccess（無ければ ADMIN_ONLY）
 * - operations = apiAccess.operations + 管理データ操作: truncateAll は管理者、export / import は useImportExport が偽なら "none"、それ以外は管理者
 */
export function buildDomainEntryAccess(config) {
  const apiAccess = config?.apiAccess ?? null;
  const base = apiAccess ? { read: apiAccess.read, write: apiAccess.write } : FAIL_CLOSED_ACCESS;
  const adminRule = { roleCategories: ["admin"] };
  const dataRule = config?.useImportExport === false ? "none" : adminRule;
  return {
    ...base,
    operations: {
      ...(apiAccess?.operations ?? {}),
      truncateAll: adminRule,
      export: dataRule,
      import: dataRule,
    },
  };
}

/** 登録の table / idColumn の行。Firestore 版は表を持たないので null。それ以外は表の定義の生成器と同じ表名と id 列 */
export function renderTableLines(camel, config) {
  if (config?.dbEngine === "Firestore") {
    return ["    // Firestore 版は表を持たない", "    table: null,", "    idColumn: null,"];
  }
  return [`    table: "${domainTableName(camel, config)}",`, '    idColumn: "id",'];
}

/**
 * domainEntry.ts の本文
 * @param {{ camel: string, config: object | null, isCore?: boolean }} options camel = ドメイン名（camelCase）、config = domain.json（無ければ null）
 */
export function renderDomainEntry({ camel, config, isCore = false }) {
  const { lines, names } = serializeAccess(buildDomainEntryAccess(config));
  const dir = `src/features/${isCore ? "core/" : ""}${camel}`;
  const out = [
    `// ${dir}/services/server/domainEntry.ts`,
    "// dc:generate が domain.json から生成する（generateFiles.registry）。手で直すときは generateFiles.registry を false にする。",
    "// 登録表 src/registry/serviceRegistry.ts はこのファイルから pnpm registry:generate が作る（dc:generate の最後に自動で走る）。",
    "// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md",
    "",
    'import type { DomainEntries } from "@/lib/domain/types";',
  ];
  if (names.length > 0) out.push(`import { ${names.sort().join(", ")} } from "${PRESET_MODULE}";`);
  out.push("", "export const domainEntries = {", `  ${camel}: {`, `    service: () => import("./${camel}Service").then((m) => m.${camel}Service),`);
  out.push(...renderTableLines(camel, config), "    access: {");
  for (const line of lines) out.push(`      ${line}`);
  out.push("    },", "  },", "} satisfies DomainEntries;", "");
  return out.join("\n");
}

/**
 * domainEntry.ts の Output。apiAccess 未宣言は fail-closed（ADMIN_ONLY）で出力し、警告する
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 */
export function renderDomainEntryOutput(ctx, warn = console.warn) {
  const { camel, config } = ctx;
  if (!config?.apiAccess) {
    warn(
      `[domainEntry] ${camel}: domain.json に apiAccess が無いため fail-closed（ADMIN_ONLY）で登録します。` +
        `公開範囲を変えるには domain.json の apiAccess を宣言して再生成してください。`,
    );
  }
  return file(path.join(ctx.dir, "services", "server", "domainEntry.ts"), renderDomainEntry({ camel, config }), {
    label: "更新しました",
    unchangedLabel: "変更なし",
  });
}
