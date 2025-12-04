// src/lib/crud/presenters.ts

import type React from "react";

export type FieldPresenterParams<T> = {
  value: unknown;
  field: string;
  record: T;
};

export type FieldPresenter<T> = (params: FieldPresenterParams<T>) => React.ReactNode;

export const formatBoolean = (
  value: unknown,
  truthyLabel: string,
  falsyLabel: string,
  fallback = "―",
) => {
  if (value === null || value === undefined) return fallback;
  return value ? truthyLabel : falsyLabel;
};

export const formatNumber = (
  value: unknown,
  { prefix = "", suffix = "" }: { prefix?: string; suffix?: string } = {},
  fallback = "―",
) => {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return `${prefix}${num.toLocaleString()}${suffix}`;
};

export const formatString = (
  value: unknown,
  { prefix = "", suffix = "" }: { prefix?: string; suffix?: string } = {},
  fallback = "―",
) => {
  if (value === null || value === undefined || value === "") return fallback;
  return `${prefix}${String(value)}${suffix}`;
};

export const formatStringArray = (
  value: unknown,
  separator = ", ",
  fallback = "―",
) => {
  if (!Array.isArray(value)) return fallback;
  if (value.length === 0) return fallback;
  return value.map((item) => String(item)).join(separator);
};

export const formatEnumLabel = (
  value: unknown,
  options?: Record<string, string>,
  fallback = "―",
) => {
  if (value === null || value === undefined) return fallback;
  if (!options) return String(value);
  const label = options[String(value)];
  return label ?? String(value);
};

export const formatDateValue = (
  value: unknown,
  format: string,
  formatter: (value: unknown, format: string) => string | null,
  fallback = "―",
) => {
  const formatted = formatter(value, format);
  return formatted ?? fallback;
};
