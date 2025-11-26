// src/lib/crud/drizzle/belongsToMany.ts

import { db } from "@/lib/drizzle";
import { eq, inArray } from "drizzle-orm";
import type { BelongsToManyRelationConfig } from "./types";

const hasOwn = Object.prototype.hasOwnProperty;

type RelationValueMap = Map<string, unknown[]>;

export function separateBelongsToManyInput<TData extends Record<string, any>>(
  data: TData,
  relations: Array<BelongsToManyRelationConfig<TData>>,
) {
  if (!relations.length) {
    return {
      sanitizedData: data,
      relationValues: new Map<string, unknown[]>(),
    };
  }

  const sanitizedData: Record<string, any> = { ...data };
  const relationValues: RelationValueMap = new Map();

  relations.forEach((relation) => {
    if (hasOwn.call(sanitizedData, relation.fieldName)) {
      const value = sanitizedData[relation.fieldName];
      relationValues.set(relation.fieldName, Array.isArray(value) ? value : []);
      delete sanitizedData[relation.fieldName];
    }
  });

  return {
    sanitizedData: sanitizedData as TData,
    relationValues,
  };
}

export async function syncBelongsToManyRelations(
  executor: typeof db,
  relations: Array<BelongsToManyRelationConfig<any>>,
  recordId: string | number,
  relationValues: RelationValueMap,
) {
  if (!relations.length || !relationValues.size) return;

  for (const relation of relations) {
    if (!relationValues.has(relation.fieldName)) continue;
    const values = relationValues.get(relation.fieldName) ?? [];

    await executor.delete(relation.throughTable).where(eq(relation.sourceColumn, recordId));
    if (!values.length) continue;

    await executor.insert(relation.throughTable).values(
      values.map((targetId) => ({
        [relation.sourceProperty]: recordId,
        [relation.targetProperty]: targetId,
      })),
    );
  }
}

export function assignLocalRelationValues<TRecord extends Record<string, any>>(
  record: TRecord,
  relations: Array<BelongsToManyRelationConfig<any>>,
  relationValues: RelationValueMap,
) {
  if (!relations.length || !relationValues.size) return record;

  relations.forEach((relation) => {
    if (!relationValues.has(relation.fieldName)) return;
    Object.assign(record, {
      [relation.fieldName]: relationValues.get(relation.fieldName) ?? [],
    });
  });

  return record;
}

export async function hydrateBelongsToManyRelations<TRecord extends Record<string, any>>(
  records: TRecord[],
  relations: Array<BelongsToManyRelationConfig<any>>,
) {
  if (!relations.length || records.length === 0) {
    return records;
  }

  const ids = records
    .map((record) => record.id)
    .filter((id): id is string | number => typeof id === "string" || typeof id === "number");
  if (!ids.length) return records;

  await Promise.all(
    relations.map(async (relation) => {
      const rows = await db
        .select({
          sourceId: relation.sourceColumn,
          targetId: relation.targetColumn,
        })
        .from(relation.throughTable)
        .where(inArray(relation.sourceColumn, ids));

      const grouped = new Map<string | number, unknown[]>();
      rows.forEach((row) => {
        const valueList = grouped.get(row.sourceId) ?? [];
        valueList.push(row.targetId);
        grouped.set(row.sourceId, valueList);
      });

      records.forEach((record) => {
        if (record.id === undefined || record.id === null) return;
        const related = grouped.get(record.id) ?? [];
        Object.assign(record, { [relation.fieldName]: related });
      });
    }),
  );

  return records;
}
