export default function buildTypes(fields, filePath) {
  const header = `// ${filePath}\n\n// このファイルは domain-config スクリプトによって自動生成されています。\n// 手動での編集は変更が上書きされる可能性があるため推奨されません。`;
  const alias = 'type FieldConstants = typeof import("../constants/field");';

  const blocks = fields.map((field) => {
    const optionType = `export type ${field.optionTypeName} = FieldConstants["${field.constantName}"][number];`;
    const valueType = `export type ${field.valueTypeName} = ${field.optionTypeName}["value"];`;
    const labelType = `export type ${field.labelTypeName} = ${field.optionTypeName}["label"];`;
    return [optionType, valueType, labelType].join("\n");
  });

  return `${header}\n\n${alias}\n\n${blocks.join("\n\n")}\n`;
}
