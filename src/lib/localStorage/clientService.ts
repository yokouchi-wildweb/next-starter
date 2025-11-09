"use client";

import { HttpError } from "@/lib/errors";

const STORAGE_UNAVAILABLE_MESSAGE = "ローカルストレージが利用できません。";
const STORAGE_PERSISTENCE_FAILURE_MESSAGE =
  "ローカルストレージへの保存に失敗しました。";
const STORAGE_RETRIEVAL_FAILURE_MESSAGE =
  "ローカルストレージからの読み取りに失敗しました。";
const STORAGE_REMOVAL_FAILURE_MESSAGE =
  "ローカルストレージからの削除に失敗しました。";

export function saveToLocalStorage(key: string, value: string) {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    throw new HttpError({
      message: STORAGE_UNAVAILABLE_MESSAGE,
      cause: new Error("localStorage is not available in this environment"),
    });
  }

  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    throw new HttpError({
      message: STORAGE_PERSISTENCE_FAILURE_MESSAGE,
      cause: error,
    });
  }
}

export function loadFromLocalStorage(key: string): string | null {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    throw new HttpError({
      message: STORAGE_UNAVAILABLE_MESSAGE,
      cause: new Error("localStorage is not available in this environment"),
    });
  }

  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    throw new HttpError({
      message: STORAGE_RETRIEVAL_FAILURE_MESSAGE,
      cause: error,
    });
  }
}

export function removeFromLocalStorage(key: string) {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    throw new HttpError({
      message: STORAGE_UNAVAILABLE_MESSAGE,
      cause: new Error("localStorage is not available in this environment"),
    });
  }

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    throw new HttpError({
      message: STORAGE_REMOVAL_FAILURE_MESSAGE,
      cause: error,
    });
  }
}
