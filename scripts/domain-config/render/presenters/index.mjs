// generateFiles.presenters: presenters.ts（一覧・詳細表示のフォーマッタ。メディア列は formatMediaThumbnail(s) で表示用 URL に解決）。
// 項目を何で表示するかは src/lib/domain/fields/presenterFor.mjs が決める。ここはその答えを式に写すだけ

import path from "node:path";
import { toCamelCase, toPascalCase } from "../../../../src/utils/stringCase.mjs";
import { requireConfig } from "../../domain/context.mjs";
import { resolveFieldName } from "../../domain/fieldName.mjs";
import { presenterFor } from "../../../../src/lib/domain/fields/presenterFor.mjs";
import { isCollectionFieldType } from "../../spec/fieldTypes.mjs";
import { file } from "../output.mjs";

const DATETIME_FORMATTER = `formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null }))`;

const buildOptionsMap = (options = []) => options.map((opt) => `"${String(opt.value)}": "${opt.label ?? opt.value}"`).join(", ");

/** presenterFor の答えの種類 → presenters.ts の式 */
const FORMATTERS = {
  boolean: () => `formatBoolean(value, "はい", "いいえ")`,
  number: () => `formatNumber(value)`,
  stringArray: () => `formatStringArray(value)`,
  enum: (spec) => `formatEnumLabel(value, { ${buildOptionsMap(spec.options)} })`,
  string: () => `formatString(value)`,
  datetime: () => DATETIME_FORMATTER,
  date: () => `formatDateValue(value, "YYYY/MM/DD", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null }))`,
  collectionThumbnails: () => `formatCollectionThumbnails(value)`,
  mediaThumbnail: () => `formatMediaThumbnail(value)`,
};

function buildFormatter(field) {
  const spec = presenterFor(field);
  return FORMATTERS[spec.kind](spec);
}

/** presenters.ts の内容 */
export function renderPresentersContent(ctx, workspace) {
  const config = requireConfig(ctx);
  const { camel, pascal } = ctx;
  const dbEngine = config.dbEngine || "";
  const template = workspace.readTemplate("presenters.ts");

  const entries = (config.fields ?? []).map(
    (field) => `  ${resolveFieldName(field.name, dbEngine)}: ({ value, field, record }) => ${buildFormatter(field)},`,
  );
  if (config.useCreatedAt) entries.push(`  createdAt: ({ value }) => ${DATETIME_FORMATTER},`);
  if (config.useUpdatedAt) entries.push(`  updatedAt: ({ value }) => ${DATETIME_FORMATTER},`);
  const body = entries.length ? entries.join("\n") : "  // TODO: add presenters";

  let content = template
    .replace(/__domain__/g, toCamelCase(config.singular) || camel)
    .replace(/__Domain__/g, toPascalCase(config.singular) || pascal)
    .replace(/__PRESENTERS_BODY__/g, body);
  // 主の集まりの項目があるときだけ import を足す（テンプレートは変えず、集まりの無いドメインの出力は同じ）
  if ((config.fields ?? []).some((field) => isCollectionFieldType(field.fieldType))) {
    content = content.replace("  formatMediaThumbnails,\n", "  formatMediaThumbnails,\n  formatCollectionThumbnails,\n");
  }
  return `${content}\n`;
}

/**
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @returns {import("../output.mjs").Output[]}
 */
export function renderPresenters(ctx, workspace) {
  return [file(path.join(ctx.dir, "presenters.ts"), renderPresentersContent(ctx, workspace), { label: "presenters.ts を生成しました" })];
}
