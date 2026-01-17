"use client";

import {
  saveToSessionStorage,
  loadFromSessionStorage,
  removeFromSessionStorage,
} from "@/lib/sessionStorage";

import { TRANSITION_TOKEN_STORAGE_KEY } from "./constants";
import type { TransitionToken } from "./types";

/**
 * トークンをsessionStorageに保存する
 */
export function saveToken(token: TransitionToken): void {
  try {
    saveToSessionStorage(TRANSITION_TOKEN_STORAGE_KEY, JSON.stringify(token));
  } catch (error) {
    console.warn("Failed to save transition token.", error);
  }
}

/**
 * sessionStorageからトークンを取得する
 */
export function getToken(): TransitionToken | null {
  try {
    const raw = loadFromSessionStorage(TRANSITION_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TransitionToken;
  } catch (error) {
    console.warn("Failed to load transition token.", error);
    return null;
  }
}

/**
 * トークンを取得し、同時に削除する（消費）
 */
export function consumeToken(): TransitionToken | null {
  const token = getToken();
  if (token) {
    try {
      removeFromSessionStorage(TRANSITION_TOKEN_STORAGE_KEY);
    } catch (error) {
      console.warn("Failed to remove transition token.", error);
    }
  }
  return token;
}
