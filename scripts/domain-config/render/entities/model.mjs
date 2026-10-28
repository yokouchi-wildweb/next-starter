// entities/model.ts（TS 型: 本体・WithRelations・WithCount・WithRelationsAndCount）。型 → TS の対応は spec/fieldTypes.mjs の表

import { toCamelCase, toPascalCase, toPlural } from "../../../../src/utils/stringCase.mjs";
import { resolveFieldName } from "../../domain/fieldName.mjs";
import { belongsToManyRelations, belongsToRelations } from "../../domain/relations.mjs";
import { isCollectionFieldType, tsType } from "../../spec/fieldTypes.mjs";

const typeLine = (name, type, required) => `  ${name}: ${required ? type : `${type} | null`};`;

function bodyLines(config, dbEngine) {
  const lines = [`  id: ${tsType(config.idType)};`];
  belongsToRelations(config).forEach((rel) => {
    lines.push(typeLine(resolveFieldName(rel.fieldName, dbEngine), tsType(rel.fieldType || config.idType), rel.required));
  });
  belongsToManyRelations(config).forEach((rel) => {
    lines.push(`  ${resolveFieldName(rel.fieldName, dbEngine)}?: ${tsType(rel.fieldType || config.idType)}[];`);
  });
  (config.fields || []).forEach((f) => {
    const fieldName = resolveFieldName(f.name, dbEngine);
    if (f.fieldType === "enum") {
      const values = (f.options || []).map((o) => `'${o.value}'`).join(" | ");
      lines.push(typeLine(fieldName, values, f.required));
    } else {
      // mediaUploaderMulti は常に NOT NULL、集まりは従属が無ければ []（どちらも null を返さない）
      const alwaysPresent = f.fieldType === "mediaUploaderMulti" || isCollectionFieldType(f.fieldType);
      lines.push(typeLine(fieldName, tsType(f.fieldType), alwaysPresent ? true : f.required));
    }
  });
  if (config.useCreatedAt) lines.push("  createdAt: Date | null;");
  if (config.useUpdatedAt) lines.push("  updatedAt: Date | null;");
  if (config.useSoftDelete) lines.push("  deletedAt: Date | null;");
  return lines;
}

/** リレーション先の型 import（同じドメインは 1 回） */
function relationTypeImports(belongsTo, belongsToMany) {
  const imports = [];
  const addedDomains = new Set();
  for (const rel of [...belongsTo, ...belongsToMany]) {
    if (addedDomains.has(rel.domain)) continue;
    addedDomains.add(rel.domain);
    imports.push(`import type { ${toPascalCase(rel.domain)} } from "@/features/${toCamelCase(rel.domain)}/entities/model";`);
  }
  return imports.join("\n");
}

function withRelationsType(pascal, dbEngine, belongsTo, belongsToMany) {
  const fields = [];
  belongsTo.forEach((rel) => {
    // field 名: sample_category_id → sample_category
    fields.push(`  /** belongsTo: ${rel.label || rel.domain} */`);
    fields.push(`  ${resolveFieldName(rel.fieldName.replace(/_id$/, ""), dbEngine)}?: ${toPascalCase(rel.domain)} | null;`);
  });
  belongsToMany.forEach((rel) => {
    // field 名: 複数形（sample_tag → sample_tags）
    fields.push(`  /** belongsToMany: ${rel.label || rel.domain} */`);
    fields.push(`  ${resolveFieldName(toPlural(rel.domain), dbEngine)}?: ${toPascalCase(rel.domain)}[];`);
  });
  return `
/**
 * リレーション展開済みの ${pascal} 型。
 * withRelations: true オプション使用時に返される。
 */
export type ${pascal}WithRelations = ${pascal} & {
${fields.join("\n")}
};
`;
}

function withCountType(pascal, dbEngine, belongsToMany) {
  const countFields = belongsToMany.map(
    (rel) => `    /** ${rel.label || rel.domain}の数 */\n    ${resolveFieldName(toPlural(rel.domain), dbEngine)}: number;`,
  );
  return `
/**
 * カウント付きの ${pascal} 型。
 * withCount: true オプション使用時に返される。
 */
export type ${pascal}WithCount = ${pascal} & {
  _count: {
${countFields.join("\n")}
  };
};
`;
}

/** @returns {string} entities/model.ts の内容 */
export function renderModel(ctx) {
  const { config, camel, pascal, dbEngine } = ctx;
  const belongsTo = belongsToRelations(config);
  const belongsToMany = belongsToManyRelations(config);
  const hasRelations = belongsTo.length > 0 || belongsToMany.length > 0;
  const hasCountable = belongsToMany.length > 0;

  let content = `// src/features/${camel}/entities/model.ts\n\n`;
  const imports = relationTypeImports(belongsTo, belongsToMany);
  if (imports) content += imports + "\n\n";
  content += `export type ${pascal} = {\n${bodyLines(config, dbEngine).join("\n")}\n};\n`;
  if (hasRelations) content += withRelationsType(pascal, dbEngine, belongsTo, belongsToMany);
  if (hasCountable) content += withCountType(pascal, dbEngine, belongsToMany);
  if (hasRelations && hasCountable) {
    content += `
/**
 * リレーション展開 + カウント付きの ${pascal} 型。
 * withRelations: true, withCount: true オプション使用時に返される。
 */
export type ${pascal}WithRelationsAndCount = ${pascal}WithRelations & ${pascal}WithCount;
`;
  }
  return content;
}
