// drizzleBase.ts の import 行: 自ドメインの表 + 中間テーブル、リレーション先ドメインの表

import { toCamelCase } from "../../../../../src/utils/stringCase.mjs";

/**
 * withRelations / countable の各スニペットから、import が要る { domain, tableImport } を集める（nested も辿る）
 * @returns {Array<{ domain: string, tableImport: string }>}
 */
export function collectRelationDomainImports({ belongsToRelations, belongsToManyObjectRelations, hasManyRelations, countableRelations }) {
  const result = [];

  function collect(items, type, isNested = false) {
    for (const item of items) {
      if (type === "belongsToMany") {
        result.push({ domain: item.relationDomain, tableImport: item.targetTableImport });
        // nested の belongsToMany は中間テーブルを所有側のドメインから import する
        if (isNested && item.throughTableVar && item.ownerDomain) {
          result.push({ domain: item.ownerDomain, tableImport: item.throughTableVar });
        }
      } else {
        result.push({ domain: item.relationDomain, tableImport: item.tableImport });
      }
      if (item.nestedImports) {
        if (item.nestedImports.belongsTo?.length > 0) collect(item.nestedImports.belongsTo, "belongsTo", true);
        if (item.nestedImports.belongsToMany?.length > 0) collect(item.nestedImports.belongsToMany, "belongsToMany", true);
        if (item.nestedImports.hasMany?.length > 0) collect(item.nestedImports.hasMany, "hasMany", true);
      }
    }
  }

  collect(belongsToRelations, "belongsTo");
  collect(belongsToManyObjectRelations, "belongsToMany");
  collect(hasManyRelations, "hasMany");

  // countableRelations は通常 throughTable のみで自ドメイン由来。softDelete 対象の場合のみ targetTable の import が追加で必要
  for (const item of countableRelations) {
    if (item.relationDomain && item.tableImport) {
      result.push({ domain: item.relationDomain, tableImport: item.tableImport });
    }
  }
  return result;
}

/** `__DrizzleEntityImports__`: 自ドメインの表と中間テーブル（重複なし） */
export function buildEntityImports(pascal, relationTableImports) {
  const imports = [`${pascal}Table`];
  relationTableImports.forEach((item) => {
    if (!imports.includes(item)) imports.push(item);
  });
  return imports.join(", ");
}

/** `__RelationTableImports__`: リレーション先ドメインごとに 1 行の import（自ドメインは __DrizzleEntityImports__ 側なので除く） */
export function buildRelationTableImports(relationDomainImports, selfDomain = "") {
  if (!relationDomainImports.length) return "";

  const byDomain = new Map();
  relationDomainImports.forEach(({ domain, tableImport }) => {
    const domainCamel = toCamelCase(domain);
    if (domainCamel === selfDomain) return;
    if (!byDomain.has(domainCamel)) byDomain.set(domainCamel, []);
    const imports = byDomain.get(domainCamel);
    if (!imports.includes(tableImport)) imports.push(tableImport);
  });

  const lines = [];
  byDomain.forEach((imports, domainCamel) => {
    lines.push(`import { ${imports.join(", ")} } from "@/features/${domainCamel}/entities/drizzle";`);
  });
  return lines.length ? lines.join("\n") + "\n" : "";
}
