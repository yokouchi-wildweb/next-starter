// src/lib/crud/events.ts

import type { HttpError } from "@/lib/errors";

export type CrudAction =
  | "getAll"
  | "getById"
  | "create"
  | "update"
  | "delete"
  | "search"
  | "bulkDeleteByIds"
  | "bulkDeleteByQuery"
  | "upsert"
  | "bulkUpsert"
  | "bulkUpdate"
  | "bulkUpdateByIds"
  | "duplicate"
  | "restore"
  | "hardDelete"
  | "reorder"
  | "searchForSorting";

export type CrudEvent = {
  action: CrudAction;
  payload?: unknown;
  success: boolean;
  error?: HttpError;
};

export type CrudEventHandler = (event: CrudEvent) => void;

let handler: CrudEventHandler | null = null;

export function registerCrudEventHandler(h: CrudEventHandler) {
  handler = h;
}

export function emitCrudEvent(event: CrudEvent) {
  handler?.(event);
}
