// entities/drizzle.ts のインデックス（pgTable の第 3 引数）: ソフトデリート時の単一ユニーク（部分インデックス）、複合ユニーク、登録の entity.json の indexes

import { toSnakeCase } from "../../../../../../src/lib/stringCase/index.mjs";
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
 * インデックス（entity.json の indexes 配列）。検索・集計頻度の高いカラム向け。unique:true は名前つき・部分・複数の列のユニーク（ユニークはこの形だけ）。
 * 形式: { fields: string[], where?: string, name?: string, using?: string, opclass?: Record<string, string> }
 *   - fields: 生成後の entities/drizzle.ts に現れるプロパティ名（業務フィールドは entity.json の name そのまま、システム列は createdAt / updatedAt / deletedAt）
 *   - where: 省略可。指定時は partial index（例: "deleted_at IS NULL"）
 *   - name: 省略可。省略時は <table>_<col1>_<col2>_..._idx（btree 以外は <table>_<cols>_<using>_idx）
 *   - using: 省略可。インデックス方式（gin / gist / brin など）。省略・"btree" は .on(...)、それ以外は .using("<method>", ...)
 *   - opclass: 省略可。{ <field>: <演算子クラス> }（例: { "title": "gin_trgm_ops" }）。該当列に .op("<opclass>") を付ける
 *   - unique: 省略可。true = uniqueIndex(名前の既定は _idx でなく _unique。名前つき・部分のユニークはこの形)
 *   - desc: 省略可。降順にする fields の名前(列に .desc())
 *   - expressions: 省略可。列の代わりの SQL の式の並び(部分ごとに 1 つ、1 つ以上。fields は書かない、name は必須)
 */
export function extraIndexes(config, tableName) {
  const indexes = Array.isArray(config.indexes) ? config.indexes : [];
  const defs = [];
  indexes.forEach((idx) => {
    if (idx.expression !== undefined) throw new Error(`エラー: ${tableName} の indexes "${idx.name ?? "?"}" の expression は expressions: ["<式>"] に書いてください(式の索引は expressions 1 つの形)`);
    if (idx.expressions !== undefined) {
      defs.push(expressionIndex(idx, tableName));
      return;
    }
    if (!Array.isArray(idx.fields) || idx.fields.length === 0) return;
    const label = idx.name || `[${idx.fields.join(", ")}]`;
    const { method, opclass } = validateExtraIndex(idx, label);
    const isDefaultMethod = method === "btree";
    const snakeFields = idx.fields.map((f) => toSnakeCase(f));
    const methodSuffix = isDefaultMethod ? "" : `_${method}`;
    const indexName = idx.name || `${tableName}_${snakeFields.join("_")}${methodSuffix}_${idx.unique ? "unique" : "idx"}`;
    const desc = Array.isArray(idx.desc) ? idx.desc : [];
    for (const field of desc) {
      if (!idx.fields.includes(field)) throw new Error(`エラー: indexes ${label} の desc "${field}" が fields にありません`);
    }
    if (indexName.length > PG_MAX_IDENTIFIER_LENGTH) {
      throw new Error(
        `エラー: インデックス名 "${indexName}" が ${PG_MAX_IDENTIFIER_LENGTH} 文字を超えています\n` +
          '  entity.json の indexes 要素に "name" を指定して短くしてください',
      );
    }
    const fieldsOnClause = idx.fields
      .map((f) => `table.${f}${opclass[f] ? `.op("${opclass[f]}")` : ""}${desc.includes(f) ? ".desc()" : ""}`)
      .join(", ");
    const indexFn = idx.unique ? "uniqueIndex" : "index";
    let indexDef = `  // ${idx.unique ? "ユニーク" : "インデックス"}: [${idx.fields.join(", ")}]${isDefaultMethod ? "" : ` (${method})`}\n`;
    // btree は既定の方式なので .on(...) のまま（using 無しの既存出力と同一にする）
    indexDef += isDefaultMethod
      ? `  ${indexFn}("${indexName}").on(${fieldsOnClause})`
      : `  ${indexFn}("${indexName}").using("${method}", ${fieldsOnClause})`;
    if (typeof idx.where === "string" && idx.where.length > 0) {
      indexDef += `.where(sql\`${idx.where}\`)`;
    }
    defs.push(indexDef);
  });
  return defs;
}

/**
 * 式の索引(expressions = 部分ごとの式の並び): uniqueIndex か index の .on(sql`<式>`, …)。名前は必須(列から作れない)
 */
function expressionIndex(idx, tableName) {
  const parts = idx.expressions;
  if (!Array.isArray(parts) || parts.length === 0) throw new Error(`エラー: ${tableName} の indexes の expressions は SQL の式の並び(1 つ以上)で書いてください`);
  if (parts.some((part) => typeof part !== "string" || part.length === 0)) throw new Error(`エラー: ${tableName} の indexes の expressions は空でない SQL の式で書いてください`);
  const label = parts.join(", ");
  if (idx.fields !== undefined) throw new Error(`エラー: indexes "${label}" は expressions と fields の両方を持てません`);
  if (typeof idx.name !== "string" || idx.name.length === 0) throw new Error(`エラー: indexes "${label}" の式の索引には name が要ります`);
  if (idx.name.length > PG_MAX_IDENTIFIER_LENGTH) throw new Error(`エラー: インデックス名 "${idx.name}" が ${PG_MAX_IDENTIFIER_LENGTH} 文字を超えています`);
  const method = idx.using ?? "btree";
  if (typeof method !== "string" || !SQL_IDENTIFIER.test(method)) throw new Error(`エラー: indexes ${idx.name} の using "${method}" が不正です`);
  const indexFn = idx.unique ? "uniqueIndex" : "index";
  const sqlParts = parts.map((part) => `sql\`${part}\``).join(", ");
  const on = method === "btree" ? `.on(${sqlParts})` : `.using("${method}", ${sqlParts})`;
  let indexDef = `  // ${idx.unique ? "ユニーク" : "インデックス"}: ${label}\n  ${indexFn}("${idx.name}")${on}`;
  if (typeof idx.where === "string" && idx.where.length > 0) indexDef += `.where(sql\`${idx.where}\`)`;
  return indexDef;
}

/** indexes に unique:true を持つものがあるか（uniqueIndex の import 判定） */
export function extraIndexesHaveUnique(config) {
  return Array.isArray(config.indexes) && config.indexes.some((i) => i.unique === true);
}

/** indexes に式の索引があるか（sql の import 判定） */
export function extraIndexesHaveExpression(config) {
  return Array.isArray(config.indexes) && config.indexes.some((i) => i.expressions !== undefined);
}

/** entity.json の indexes に where 句を持つものがあるか（sql の import 判定） */
export function extraIndexesHaveWhere(config) {
  const indexes = Array.isArray(config.indexes) ? config.indexes : [];
  return indexes.some((i) => typeof i.where === "string" && i.where.length > 0);
}
