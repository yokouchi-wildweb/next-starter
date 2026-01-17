"use client";

import { HttpError } from "@/lib/errors";

const STORAGE_UNAVAILABLE_MESSAGE = "セッションストレージが利用できません。";
const STORAGE_PERSISTENCE_FAILURE_MESSAGE =
  "セッションストレージへの保存に失敗しました。";
const STORAGE_RETRIEVAL_FAILURE_MESSAGE =
  "セッションストレージからの読み取りに失敗しました。";
const STORAGE_REMOVAL_FAILURE_MESSAGE =
  "セッションストレージからの削除に失敗しました。";

export function saveToSessionStorage(key: string, value: string) {
  if (typeof window === "undefined" || !("sessionStorage" in window)) {
    throw new HttpError({
      message: STORAGE_UNAVAILABLE_MESSAGE,
      cause: new Error("sessionStorage is not available in this environment"),
    });
  }

  try {
    window.sessionStorage.setItem(key, value);
  } catch (error) {
    throw new HttpError({
      message: STORAGE_PERSISTENCE_FAILURE_MESSAGE,
      cause: error,
    });
  }
}

export function loadFromSessionStorage(key: string): string | null {
  if (typeof window === "undefined" || !("sessionStorage" in window)) {
    throw new HttpError({
      message: STORAGE_UNAVAILABLE_MESSAGE,
      cause: new Error("sessionStorage is not available in this environment"),
    });
  }

  try {
    return window.sessionStorage.getItem(key);
  } catch (error) {
    throw new HttpError({
      message: STORAGE_RETRIEVAL_FAILURE_MESSAGE,
      cause: error,
    });
  }
}

export function removeFromSessionStorage(key: string) {
  if (typeof window === "undefined" || !("sessionStorage" in window)) {
    throw new HttpError({
      message: STORAGE_UNAVAILABLE_MESSAGE,
      cause: new Error("sessionStorage is not available in this environment"),
    });
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch (error) {
    throw new HttpError({
      message: STORAGE_REMOVAL_FAILURE_MESSAGE,
      cause: error,
    });
  }
}
