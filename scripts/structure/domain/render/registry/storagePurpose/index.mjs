// services/server/storagePurposes.ts（毎回上書き）: domain.json のメディア項目のファイル用途。
// src/registry/storagePurposeRegistry.ts はこのファイルの一覧（pnpm generate registry が走査で作る）。
// 検査（規則違反）は Output を作る時点で済ませ、例外で止める（書き込みの前）

import path from "node:path";
import { featureRel } from "../../../domain/context.mjs";
import { loadRoleCategories } from "../../../domain/roles.mjs";
import { file } from "../../output.mjs";
import { buildStoragePurposeEntries } from "./entries.mjs";

export { buildStoragePurposeEntries } from "./entries.mjs";
export { allowsGeneralUser, resolveOperationRule, unionUploadRules } from "./rules.mjs";

const PREFIX = "[storagePurposes]";

/** 1 ドメイン分のファイルの本文 */
export function renderStoragePurposesContent(rel, entries) {
  const lines = entries.map(({ id, value }) => `  "${id}": ${value},`);
  return [
    `// ${rel}/services/server/storagePurposes.ts`,
    "// pnpm generate domain が domain.json のメディア項目から生成する。手で直さない（手で持つなら domain.json の generate を false）。",
    "// 型と規則: src/lib/storage/README.md",
    "",
    'import "server-only";',
    "",
    ...(lines.some((line) => /\bstorageObjectConfig\./.test(line)) ? ['import { storageObjectConfig } from "@/features/storageObject/config";'] : []),
    'import type { StoragePurposeMap } from "@/lib/storage";',
    "",
    "export const purposes = {",
    ...lines,
    "} satisfies StoragePurposeMap;",
    "",
  ].join("\n");
}

/**
 * @param {import("../../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../../domain/workspace.mjs").Workspace} workspace
 * @returns {import("../../output.mjs").Output[]} メディア項目か domain.json が無ければ空
 */
export function renderStoragePurposesOutput(ctx, workspace, warn = console.warn) {
  if (!ctx.config) return [];

  const { entries, warnings, errors } = buildStoragePurposeEntries({
    camel: ctx.camel,
    config: ctx.config,
    roleCategories: loadRoleCategories(workspace),
  });
  warnings.forEach((w) => warn(`${PREFIX} ${w}`));
  if (errors.length > 0) {
    throw new Error(`${PREFIX} ファイル用途を生成できません:\n${errors.map((e) => ` - ${e}`).join("\n")}`);
  }
  if (entries.length === 0) return [];
  return [
    file(path.join(ctx.dir, "services", "server", "storagePurposes.ts"), renderStoragePurposesContent(featureRel(ctx), entries), {
      label: "ファイル用途を生成しました",
    }),
  ];
}
