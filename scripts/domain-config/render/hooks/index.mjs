// 生成カテゴリ hooks: hooks/use*<Domain>.ts（どれが生成されるかは catalog.mjs。詳細: src/lib/crud/hooks/README.md）

import path from "node:path";
import { file } from "../output.mjs";
import { replaceDomainTokens } from "../tokens.mjs";
import { hookSpecsFor } from "./catalog.mjs";
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
 * @returns {import("../output.mjs").Output[]} domain.json の設定どおりのフック
 */
export function renderHooks(ctx, workspace) {
  return hookSpecsFor(ctx.config).map((spec) => renderHook(ctx, workspace, spec));
}
