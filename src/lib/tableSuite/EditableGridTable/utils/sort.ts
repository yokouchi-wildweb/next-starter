"use client";

import { readCellValue } from "./value";
import type { EditableGridColumn, EditableGridOrderRule } from "../types";

export const normalizeOrderRules = <T,>(rules?: EditableGridOrderRule<T>[]) =>
  (rules ?? [])
    .filter((rule): rule is EditableGridOrderRule<T> & { field: string } => Boolean(rule?.field))
    .map((rule) => ({
      field: rule.field,
      direction: rule.direction ?? "asc",
    }));

export const compareRows = <T,>(
  a: T,
  b: T,
  rules: Array<EditableGridOrderRule<T> & { direction: "asc" | "desc" }>,
  columnMap: Map<string, EditableGridColumn<T>>,
  aIndex: number,
  bIndex: number,
) => {
  for (const rule of rules) {
    const column = columnMap.get(rule.field);
    const aValue = column ? readCellValue(a, column) : (a as Record<string, unknown>)[rule.field];
    const bValue = column ? readCellValue(b, column) : (b as Record<string, unknown>)[rule.field];
    const comparison = compareValues(aValue, bValue);
    if (comparison !== 0) {
      return rule.direction === "desc" ? -comparison : comparison;
    }
  }
  return aIndex - bIndex;
};

const compareValues = (a: unknown, b: unknown) => {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }

  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b, "ja");
  }

  return String(a).localeCompare(String(b), "ja");
};

