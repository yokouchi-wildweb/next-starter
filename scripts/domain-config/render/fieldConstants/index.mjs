// generateFiles.fieldConstants: constants/field.ts（選択肢の定数）と types/field.ts（その型）。options を持つ項目があるときだけ

import path from "node:path";
import { toPascalCase } from "../../../../src/utils/stringCase.mjs";
import { requireConfig } from "../../domain/context.mjs";
import { collectOptionFields } from "../../spec/fieldTypes.mjs";
import { file } from "../output.mjs";

const HEADER_NOTE =
  "// このファイルは domain-config スクリプトによって自動生成されています。\n// 手動での編集は変更が上書きされる可能性があるため推奨されません。";

function formatOption(option, indent = 2) {
  const pad = " ".repeat(indent);
  return `${pad}{ value: ${JSON.stringify(option.value)}, label: ${JSON.stringify(option.label)} }`;
}

function formatOptions(options) {
  return ["[", options.map((option) => formatOption(option)).join(",\n"), "] as const"].join("\n");
}

export function buildConstants(fields, filePath) {
  const blocks = fields.map((field) => `export const ${field.constantName} = ${formatOptions(field.options)};`);
  return `// ${filePath}\n\n${HEADER_NOTE}\n\n${blocks.join("\n\n")}\n`;
}

export function buildTypes(fields, filePath) {
  const alias = 'type FieldConstants = typeof import("../constants/field");';
  const blocks = fields.map((field) =>
    [
      `export type ${field.optionTypeName} = FieldConstants["${field.constantName}"][number];`,
      `export type ${field.valueTypeName} = ${field.optionTypeName}["value"];`,
      `export type ${field.labelTypeName} = ${field.optionTypeName}["label"];`,
    ].join("\n"),
  );
  return `// ${filePath}\n\n${HEADER_NOTE}\n\n${alias}\n\n${blocks.join("\n\n")}\n`;
}

/**
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 * @returns {import("../output.mjs").Output[]} options を持つ項目が無ければ空
 */
export function renderFieldConstants(ctx) {
  const config = requireConfig(ctx);
  const { camel, pascal } = ctx;
  const optionFields = collectOptionFields(config);
  if (!optionFields.length) return [];

  const fieldMeta = optionFields.map((field) => {
    const pascalField = toPascalCase(field.name) || field.name;
    return {
      name: field.name,
      constantName: `${pascal}${pascalField}Options`,
      optionTypeName: `${pascal}${pascalField}Option`,
      valueTypeName: `${pascal}${pascalField}Value`,
      labelTypeName: `${pascal}${pascalField}Label`,
      options: field.options.map((option) => ({ value: option.value, label: option.label })),
    };
  });

  const constantRelPath = path.posix.join("src", "features", camel, "constants", "field.ts");
  const typeRelPath = path.posix.join("src", "features", camel, "types", "field.ts");
  return [
    file(path.join(ctx.dir, "constants", "field.ts"), buildConstants(fieldMeta, constantRelPath), { label: "フィールド定数を生成しました" }),
    file(path.join(ctx.dir, "types", "field.ts"), buildTypes(fieldMeta, typeRelPath), { label: "フィールド型を生成しました" }),
  ];
}
