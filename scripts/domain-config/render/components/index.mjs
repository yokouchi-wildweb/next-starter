// generateFiles.components: components/Admin<Domain>{Create,Edit,List,Sort}/ と components/common/*

import path from "node:path";
import { file } from "../output.mjs";
import { replaceDomainTokens } from "../tokens.mjs";
import { COMPONENT_SPECS, componentSpecsFor } from "./catalog.mjs";
import { generateFieldsFromConfig } from "./fields.mjs";
import { applyAutoSave, applyDuplicateButton } from "./tweaks.mjs";

function renderBody(ctx, workspace, spec) {
  const { config, camel, pascal } = ctx;
  if (spec.tweak === "fields" && config) {
    // ctx.collectionChildren = 主の集まりの項目名 → 従属（pipeline が組の解決から載せる。無ければ用途名だけ collection.domain から）
    return generateFieldsFromConfig(config, ctx.collectionChildren).replace(/__domain__/g, camel).replace(/__Domain__/g, pascal);
  }
  const templateRel = spec.templateFor ? spec.templateFor(config) : spec.template;
  const template = workspace.readTemplate("components", ...templateRel.split("/"));
  if (spec.tweak === "autoSave") return replaceDomainTokens(applyAutoSave(template, config), ctx);
  if (spec.tweak === "duplicateButton") return replaceDomainTokens(applyDuplicateButton(template, config), ctx);
  return replaceDomainTokens(template, ctx);
}

/** 1 コンポーネント分の Output。null = 生成しない（並び替えページを sortOrderField 無しで選んだとき） */
export function renderComponent(ctx, workspace, spec, warn = console.warn) {
  if (spec.key === "adminSort" && !ctx.config?.sortOrderField) {
    warn(`${ctx.camel}: sortOrderField が設定されていないため Admin__Domain__Sort をスキップします`);
    return null;
  }
  const outputRel = replaceDomainTokens(spec.output ?? spec.template, ctx);
  const outputFile = path.join(ctx.dir, "components", ...outputRel.split("/"));
  return file(outputFile, renderBody(ctx, workspace, spec), { label: "コンポーネントを生成しました" });
}

/**
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @param {string[]} [keys] 生成するコンポーネントの key（省略 = domain.json の設定どおり）
 * @returns {import("../output.mjs").Output[]}
 */
export function renderComponents(ctx, workspace, keys) {
  const specs = keys
    ? keys.map((key) => COMPONENT_SPECS.find((spec) => spec.key === key)).filter(Boolean)
    : componentSpecsFor(ctx.config);
  return specs.map((spec) => renderComponent(ctx, workspace, spec)).filter(Boolean);
}
