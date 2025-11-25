"use client";

import dayjs, { isDayjs } from "dayjs";

import type { EditableGridColumn, EditableGridEditorType } from "../types";

export const readCellValue = <T,>(row: T, column: EditableGridColumn<T>) => {
  if (column.getValue) {
    return column.getValue(row);
  }
  return (row as Record<string, unknown>)[column.field];
};

export const formatCellValue = <T,>(row: T, column: EditableGridColumn<T>) => {
  const value = readCellValue(row, column);
  if (column.formatValue) {
    return column.formatValue(value, row);
  }
  return formatByType(column.editorType, value);
};

export const parseCellValue = <T,>(inputValue: unknown, row: T, column: EditableGridColumn<T>) => {
  if (column.parseValue) {
    return column.parseValue(inputValue, row);
  }
  return parseByType(column.editorType, inputValue);
};

const formatByType = (type: EditableGridEditorType, value: unknown) => {
  if (type === "number") {
    if (value === "" || value === null || value === undefined) {
      return "";
    }
    return String(value);
  }

  if (type === "multi-select") {
    if (!Array.isArray(value) || value.length === 0) {
      return "";
    }
    return value.map((entry) => String(entry)).join(", ");
  }

  if (type === "date" || type === "time" || type === "datetime") {
    const format = type === "date" ? "YYYY/MM/DD" : type === "time" ? "HH:mm" : "YYYY/MM/DD HH:mm";
    const formatted = formatDateValue(value, format);
    return formatted ?? "";
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
};

const parseByType = (type: EditableGridEditorType, value: unknown) => {
  if (type === "number") {
    if (value === "") {
      return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (type === "multi-select") {
    if (Array.isArray(value)) {
      return value;
    }
    if (value == null || value === "") {
      return [];
    }
    return Array.isArray(value) ? value : [];
  }

  if (type === "date" || type === "time" || type === "datetime") {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
    if (value instanceof Date) {
      return value;
    }
    if (isDayjs(value)) {
      return value.toDate();
    }
    if (typeof value === "string" || typeof value === "number") {
      const parsed = dayjs(value);
      return parsed.isValid() ? parsed.toDate() : null;
    }
    return null;
  }

  return value;
};

const formatDateValue = (value: unknown, format: string) => {
  if (value == null) {
    return null;
  }
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    !(value instanceof Date) &&
    !isDayjs(value)
  ) {
    return null;
  }
  const date = dayjs(value);
  if (!date.isValid()) {
    return typeof value === "string" ? value : null;
  }
  return date.format(format);
};
