// src/lib/appEnv/appEnv.ts
//
// 段階(APP_ENV)の唯一の読み手(本部 D178)。process.env.APP_ENV / NODE_ENV の直接の読みはこのファイルだけに許す
// (lint app-env/single-reader)。値が無い・知らない値は production(危ない側を開けない)。
// 呼ぶたびに読む(キャッシュしない): テストが withAppEnv で差し替えられるように。
// client: next.config.ts の env が正規化した値を埋め込むので、`process.env.APP_ENV` の字面のまま読む(分割代入にしない)。

export const APP_ENVS = ["development", "staging", "production"] as const;

export type AppEnv = (typeof APP_ENVS)[number];

const isAppEnv = (value: unknown): value is AppEnv =>
  typeof value === "string" && (APP_ENVS as readonly string[]).includes(value);

/** 文字列を段階に直す。無い・知らない値は "production" */
export function parseAppEnv(raw: string | undefined | null): AppEnv {
  const value = raw?.trim();
  return isAppEnv(value) ? value : "production";
}

/** 今の段階(APP_ENV)。無い・知らない値は "production" */
export function getAppEnv(): AppEnv {
  return parseAppEnv(process.env.APP_ENV);
}

export const isDevelopment = (): boolean => getAppEnv() === "development";
export const isStaging = (): boolean => getAppEnv() === "staging";
export const isProduction = (): boolean => getAppEnv() === "production";

/**
 * テスト用: APP_ENV を差し替え、差し替える前に戻す関数を返す(undefined = 値なし)。
 * 1 つのテストの中で段階を何度も切り替えるとき用。普通は withAppEnv を使う
 */
export function setAppEnv(value: string | undefined): () => void {
  const original = process.env.APP_ENV;
  if (value === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = value;
  return () => {
    if (original === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = original;
  };
}

/**
 * テスト用: APP_ENV を一時的に差し替えて fn を実行し、元に戻す(Promise を返す fn は決着後に戻す)。
 * undefined を渡すと「値が無い」状態にする。
 */
export function withAppEnv<T>(value: string | undefined, fn: () => T): T {
  const restore = setAppEnv(value);
  let result: T;
  try {
    result = fn();
  } catch (error) {
    restore();
    throw error;
  }
  if (result instanceof Promise) {
    return result.finally(restore) as T;
  }
  restore();
  return result;
}
