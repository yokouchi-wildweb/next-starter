// src/registry/storagePurposeRegistry.ts の AUTO ブロックへ、domain.json のメディア項目のファイル用途を書き込む。
// 検査（規則違反）は Output を作る時点で済ませ、例外で止める（書き込みの前）

import { loadRoleCategories } from "../../../domain/roles.mjs";
import { patch } from "../../output.mjs";
import { applyStoragePurposeEntries, removeStoragePurposeEntries } from "./apply.mjs";
import { buildStoragePurposeEntries } from "./entries.mjs";

export { applyStoragePurposeEntries, removeStoragePurposeEntries, syncStorageConfigImport } from "./apply.mjs";
export { buildStoragePurposeEntries } from "./entries.mjs";
export { allowsGeneralUser, resolveOperationRule, unionUploadRules } from "./rules.mjs";

const PREFIX = "[storagePurposeRegistry]";

/**
 * @param {import("../../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../../domain/workspace.mjs").Workspace} workspace
 * @returns {import("../../output.mjs").Output[]} 登録表か domain.json が無ければ空
 */
export function renderStoragePurposePatch(ctx, workspace, warn = console.warn) {
  const filePath = workspace.registryPath("storagePurposeRegistry.ts");
  if (!workspace.exists(filePath)) return [];
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

  return [
    patch(filePath, (before) => {
      const { text, skipped } = applyStoragePurposeEntries(before, { camel: ctx.camel, entries });
      const warns = skipped.map((id) => `${PREFIX} ${id}: AUTO ブロックの外に同じ ID があるため上書きしません（手書きの定義を使います）`);
      return { text: text !== before ? text : undefined, warns };
    }),
  ];
}

/**
 * dc:delete: 1 ドメイン分の AUTO エントリを消す
 * @returns {string | null} 変更後の本文（変更が無ければ null）
 */
export function removeStoragePurposesText(before, camel) {
  const after = removeStoragePurposeEntries(before, { camel });
  return after === before ? null : after;
}
