"use client";

import { HttpError } from "@/lib/errors";

import type { StorageClient, StorageType } from "./types";

const STORAGE_LABELS: Record<StorageType, string> = {
  local: "ローカルストレージ",
  session: "セッションストレージ",
};

function getStorage(type: StorageType): Storage | null {
  if (typeof window === "undefined") return null;
  return type === "local" ? window.localStorage : window.sessionStorage;
}

function createErrorMessages(type: StorageType) {
  const label = STORAGE_LABELS[type];
  return {
    unavailable: `${label}が利用できません。`,
    saveFailed: `${label}への保存に失敗しました。`,
    loadFailed: `${label}からの読み取りに失敗しました。`,
    removeFailed: `${label}からの削除に失敗しました。`,
    clearFailed: `${label}のクリアに失敗しました。`,
  };
}

/**
 * ストレージクライアントを生成する
 *
 * @example
 * const localClient = createStorageClient("local");
 * localClient.save("key", "value");
 *
 * const sessionClient = createStorageClient("session");
 * const value = sessionClient.load("key");
 */
export function createStorageClient(type: StorageType): StorageClient {
  const messages = createErrorMessages(type);

  const ensureStorage = (): Storage => {
    const storage = getStorage(type);
    if (!storage) {
      throw new HttpError({
        message: messages.unavailable,
        cause: new Error(`${type}Storage is not available in this environment`),
      });
    }
    return storage;
  };

  return {
    save: (key: string, value: string) => {
      try {
        ensureStorage().setItem(key, value);
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError({
          message: messages.saveFailed,
          cause: error,
        });
      }
    },

    load: (key: string): string | null => {
      try {
        return ensureStorage().getItem(key);
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError({
          message: messages.loadFailed,
          cause: error,
        });
      }
    },

    remove: (key: string) => {
      try {
        ensureStorage().removeItem(key);
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError({
          message: messages.removeFailed,
          cause: error,
        });
      }
    },

    exists: (key: string): boolean => {
      try {
        return ensureStorage().getItem(key) !== null;
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError({
          message: messages.loadFailed,
          cause: error,
        });
      }
    },

    clear: () => {
      try {
        ensureStorage().clear();
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError({
          message: messages.clearFailed,
          cause: error,
        });
      }
    },
  };
}

// 便利なシングルトンインスタンス
export const localStorageClient = createStorageClient("local");
export const sessionStorageClient = createStorageClient("session");

// 後方互換用のエイリアス関数
export const saveToLocalStorage = localStorageClient.save;
export const loadFromLocalStorage = localStorageClient.load;
export const removeFromLocalStorage = localStorageClient.remove;

export const saveToSessionStorage = sessionStorageClient.save;
export const loadFromSessionStorage = sessionStorageClient.load;
export const removeFromSessionStorage = sessionStorageClient.remove;
