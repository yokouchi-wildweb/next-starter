// 行単位で追記するレジストリ: adminDataMenu.ts / schemaRegistry.ts / domainConfigRegistry.ts。
// 未登録なら AUTO-GENERATED-END の直前に 1 行足す。登録済み（引用符・空白違いも含む）なら足さない

import { toKebabCase, toSnakeCase } from "../../../../src/utils/stringCase.mjs";
import { log, patch } from "../output.mjs";

const END_MARKER = "// --- AUTO-GENERATED-END ---";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 管理画面のデータ管理メニューに項目を足す（addToAdminDataMenu のとき） */
export function renderAdminDataMenuPatch(workspace, { camelPlural, label }) {
  const menuPath = workspace.registryPath("adminDataMenu.ts");
  const href = `/admin/${toKebabCase(camelPlural)}`;
  const hrefPattern = new RegExp(`href:\\s*["']${escapeRegExp(href)}["']`);
  return patch(menuPath, (text) => {
    const lines = text.trimEnd().split(/\r?\n/);
    if (lines.some((line) => hrefPattern.test(line))) {
      return { logs: [`スキップしました（既に存在）: ${menuPath}`] };
    }
    const marker = lines.findIndex((l) => l.includes(END_MARKER));
    const insertIndex = marker !== -1 ? marker : lines.length - 1;
    lines.splice(insertIndex, 0, `  { title: "${label}", href: "${href}" },`);
    return { text: lines.join("\n") + "\n", logs: [`更新しました: ${menuPath}`] };
  });
}

/** schemaRegistry.ts に entities/drizzle の export を足す。Firestore ドメインは表が無いのでスキップ */
export function renderSchemaRegistryPatch(workspace, { camel, dbEngine }) {
  if (dbEngine === "Firestore") {
    return log(`Firestore ドメインのためスキーマ登録をスキップしました: ${camel}`);
  }
  const schemaPath = workspace.registryPath("schemaRegistry.ts");
  const existingPattern = new RegExp(`^\\s*export\\s*\\*\\s*from\\s*["']@/features/${camel}/entities/drizzle["']`);
  return patch(schemaPath, (text) => {
    const lines = text.split(/\r?\n/);
    if (lines.some((l) => existingPattern.test(l))) {
      return { logs: [`スキップしました（既に存在）: ${schemaPath}`] };
    }
    const marker = lines.findIndex((l) => l.includes(END_MARKER));
    const exportIndex = marker !== -1 ? marker : lines.findIndex((l) => l.trim() === "export {};");
    lines.splice(exportIndex, 0, `export * from "@/features/${camel}/entities/drizzle";`);
    return { text: lines.join("\n"), logs: [`更新しました: ${schemaPath}`] };
  });
}

/** domainConfigRegistry.ts に domain.json の import と map のエントリを足す。両方あれば書かない */
export function renderDomainConfigRegistryPatch(workspace, { camel }) {
  const registryPath = workspace.registryPath("domainConfigRegistry.ts");
  const snake = toSnakeCase(camel);
  const importPattern = new RegExp(`^\\s*import\\s+${camel}Config\\s+from\\s*["']@/features/${camel}/domain\\.json["']`);
  const mapPattern = new RegExp(`^\\s*["']?${snake}["']?\\s*:\\s*${camel}Config\\b`);
  return patch(registryPath, (text) => {
    const content = text.split(/\r?\n/);
    const hasImport = content.some((l) => importPattern.test(l));
    const hasEntry = content.some((l) => mapPattern.test(l));
    if (hasImport && hasEntry) {
      return { logs: [`スキップしました（既に存在）: ${registryPath}`] };
    }
    if (!hasImport) {
      let lastImport = -1;
      for (let i = 0; i < content.length; i++) {
        if (content[i].startsWith("import")) lastImport = i;
      }
      content.splice(lastImport + 1, 0, `import ${camel}Config from "@/features/${camel}/domain.json";`);
    }
    if (!hasEntry) {
      // マーカーが無ければ `} as const;` の手前
      let insertIndex = content.findIndex((l) => l.includes(END_MARKER));
      if (insertIndex === -1) {
        insertIndex = content.findIndex((l) => l.trim().startsWith("} as const"));
      }
      content.splice(insertIndex, 0, `  ${snake}: ${camel}Config,`);
    }
    return { text: content.join("\n"), logs: [`更新しました: ${registryPath}`] };
  });
}
