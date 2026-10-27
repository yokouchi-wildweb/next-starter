// entities/drizzle.ts のインデックス（pgTable の第 3 引数）: ソフトデリート時の単一ユニーク（部分インデックス）、複合ユニーク、domain.json の indexes

import { toSnakeCase } from "../../../../../src/utils/stringCase.mjs";
import { PG_MAX_IDENTIFIER_LENGTH } from "../../../domain/names.mjs";

// using / opclass の値は生成コードにそのまま入るため、識別子の形だけを許す
const SQL_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/** ソフトデリート + 単一フィールドユニーク制約（アクティブなレコードのみ） */
export function uniqueActiveIndexes(tableName, uniqueFields) {
  return uniqueFields.map(
    (uf) =>
      `  // ${uf.name} のユニーク制約（アクティブなレコードのみ）\n` +
      `  uniqueIndex("${tableName}_${uf.columnName}_unique_active").on(table.${uf.name}).where(sql\`deleted_at IS NULL\`)`,
  );
}

/** 複合ユニーク制約（ソフトデリート時は部分インデックス） */
export function compositeUniqueIndexes(config, tableName) {
  return (config.compositeUniques || []).map((compositeFields, index) => {
    const fieldsOnClause = compositeFields.map((f) => `table.${f}`).join(", ");
    let indexDef = `  // 複合ユニーク制約 ${index}: [${compositeFields.join(", ")}]\n`;
    indexDef += `  uniqueIndex("${tableName}_composite_unique_${index}").on(${fieldsOnClause})`;
    if (config.useSoftDelete) {
      indexDef += `.where(sql\`deleted_at IS NULL\`)`;
    }
    return indexDef;
  });
}

function validateExtraIndex(idx, label) {
  const method = idx.using ?? "btree";
  if (typeof method !== "string" || !SQL_IDENTIFIER.test(method)) {
    throw new Error(`エラー: indexes ${label} の using "${method}" が不正です（例: "gin" / "gist" / "btree"）`);
  }
  const opclass = idx.opclass ?? {};
  if (typeof opclass !== "object" || opclass === null || Array.isArray(opclass)) {
    throw new Error(`エラー: indexes ${label} の opclass は { "<field>": "<演算子クラス>" } の形で指定してください`);
  }
  for (const [field, op] of Object.entries(opclass)) {
    if (!idx.fields.includes(field)) {
      throw new Error(`エラー: indexes ${label} の opclass のキー "${field}" が fields にありません`);
    }
    if (typeof op !== "string" || !SQL_IDENTIFIER.test(op)) {
      throw new Error(`エラー: indexes ${label} の opclass "${field}": "${op}" が不正です（例: "gin_trgm_ops"）`);
    }
  }
  return { method, opclass };
}

/**
 * 非ユニークインデックス（domain.json の indexes 配列）。検索・集計頻度の高いカラム向け（compositeUniques とは別物）。
 * 形式: { fields: string[], where?: string, name?: string, using?: string, opclass?: Record<string, string> }
 *   - fields: 生成後の entities/drizzle.ts に現れるプロパティ名（業務フィールドは domain.json の name そのまま、システム列は createdAt / updatedAt / deletedAt）
 *   - where: 省略可。指定時は partial index（例: "deleted_at IS NULL"）
 *   - name: 省略可。省略時は <table>_<col1>_<col2>_..._idx（btree 以外は <table>_<cols>_<using>_idx）
 *   - using: 省略可。インデックス方式（gin / gist / brin など）。省略・"btree" は .on(...)、それ以外は .using("<method>", ...)
 *   - opclass: 省略可。{ <field>: <演算子クラス> }（例: { "title": "gin_trgm_ops" }）。該当列に .op("<opclass>") を付ける
 */
export function extraIndexes(config, tableName) {
  const indexes = Array.isArray(config.indexes) ? config.indexes : [];
  const defs = [];
  indexes.forEach((idx) => {
    if (!Array.isArray(idx.fields) || idx.fields.length === 0) return;
    const label = idx.name || `[${idx.fields.join(", ")}]`;
    const { method, opclass } = validateExtraIndex(idx, label);
    const isDefaultMethod = method === "btree";
    const snakeFields = idx.fields.map((f) => toSnakeCase(f));
    const methodSuffix = isDefaultMethod ? "" : `_${method}`;
    const indexName = idx.name || `${tableName}_${snakeFields.join("_")}${methodSuffix}_idx`;
    if (indexName.length > PG_MAX_IDENTIFIER_LENGTH) {
      throw new Error(
        `エラー: インデックス名 "${indexName}" が ${PG_MAX_IDENTIFIER_LENGTH} 文字を超えています\n` +
          '  domain.json の indexes 要素に "name" を指定して短くしてください',
      );
    }
    const fieldsOnClause = idx.fields.map((f) => (opclass[f] ? `table.${f}.op("${opclass[f]}")` : `table.${f}`)).join(", ");
    let indexDef = `  // インデックス: [${idx.fields.join(", ")}]${isDefaultMethod ? "" : ` (${method})`}\n`;
    // btree は既定の方式なので .on(...) のまま（using 無しの既存出力と同一にする）
    indexDef += isDefaultMethod
      ? `  index("${indexName}").on(${fieldsOnClause})`
      : `  index("${indexName}").using("${method}", ${fieldsOnClause})`;
    if (typeof idx.where === "string" && idx.where.length > 0) {
      indexDef += `.where(sql\`${idx.where}\`)`;
    }
    defs.push(indexDef);
  });
  return defs;
}

/** domain.json の indexes に where 句を持つものがあるか（sql の import 判定） */
export function extraIndexesHaveWhere(config) {
  const indexes = Array.isArray(config.indexes) ? config.indexes : [];
  return indexes.some((i) => typeof i.where === "string" && i.where.length > 0);
}
