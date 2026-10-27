// generateFiles.hooks: hooks/use*<Domain>.ts（どれが生成されるかは catalog.mjs。詳細: src/lib/crud/hooks/README.md）

import path from "node:path";
import { file } from "../output.mjs";
import { replaceDomainTokens } from "../tokens.mjs";
import { HOOK_SPECS, hookSpecsFor } from "./catalog.mjs";
import { injectViewModalRelations } from "./viewModal.mjs";

/** 1 フック分の Output */
export function renderHook(ctx, workspace, spec) {
  let content = replaceDomainTokens(workspace.readTemplate("hooks", spec.template), ctx);
  if (spec.key === "viewModal") content = injectViewModalRelations(content, ctx.config);
  const outputFile = path.join(ctx.dir, "hooks", replaceDomainTokens(spec.template, ctx));
  return file(outputFile, content, { label: "フックを生成しました" });
}

/**
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @param {string[]} [keys] 生成するフックの key（省略 = domain.json の設定どおり）
 * @returns {import("../output.mjs").Output[]}
 */
export function renderHooks(ctx, workspace, keys) {
  const specs = keys ? keys.map((key) => HOOK_SPECS.find((spec) => spec.key === key)).filter(Boolean) : hookSpecsFor(ctx.config);
  return specs.map((spec) => renderHook(ctx, workspace, spec));
}
