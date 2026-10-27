// generateFiles.presenters: presenters.ts（一覧・詳細表示のフォーマッタ。メディア列は formatMediaThumbnail(s) で表示用 URL に解決）。
// 型 → フォーマッタの種類は spec/fieldTypes.mjs の表、無ければ formInput で決める

import path from "node:path";
import { toCamelCase, toPascalCase } from "../../../../src/utils/stringCase.mjs";
import { requireConfig } from "../../domain/context.mjs";
import { resolveFieldName } from "../../domain/fieldName.mjs";
import { presenterKind } from "../../spec/fieldTypes.mjs";
import { file } from "../output.mjs";

const DATETIME_FORMATTER = `formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null }))`;

const buildOptionsMap = (options = []) => options.map((opt) => `"${String(opt.value)}": "${opt.label ?? opt.value}"`).join(", ");

function buildFormatter(field) {
  const { fieldType, formInput, options } = field;
  switch (presenterKind(fieldType)) {
    case "boolean":
      return `formatBoolean(value, "はい", "いいえ")`;
    case "number":
      return `formatNumber(value)`;
    case "stringArray":
      return `formatStringArray(value)`;
    case "enum":
      if (Array.isArray(options) && options.length) {
        return `formatEnumLabel(value, { ${buildOptionsMap(options)} })`;
      }
      return `formatString(value)`;
    default:
      break;
  }
  if (formInput === "numberInput" || formInput === "stepperInput") return `formatNumber(value)`;
  if (formInput === "textarea" || formInput === "textInput") return `formatString(value)`;
  if (formInput === "datetimeInput") return DATETIME_FORMATTER;
  if (formInput === "dateInput") {
    return `formatDateValue(value, "YYYY/MM/DD", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null }))`;
  }
  // メディア列: 値（storage ref・旧 URL）を resolveStorageSrc で解決してサムネイル表示する
  if (fieldType === "mediaUploaderMulti" || formInput === "mediaUploaderMulti") return `formatMediaThumbnails(value)`;
  if (fieldType === "mediaUploader" || formInput === "mediaUploader" || formInput === "fileUploader") return `formatMediaThumbnail(value)`;
  return `formatString(value)`;
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

  const content = template
    .replace(/__domain__/g, toCamelCase(config.singular) || camel)
    .replace(/__Domain__/g, toPascalCase(config.singular) || pascal)
    .replace(/__PRESENTERS_BODY__/g, body);
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
