// src/lib/domain/service/server/getService.ts
// 登録表（serviceRegistry）からドメイン名でサービスを引く汎用関数。
// lib は registry を import しない: 登録表は引数で受ける。serviceRegistry を結んだ版は src/wiring/domainRegistry.ts

import "server-only";

import type { DomainRegistry, DomainService, DomainServiceLookup } from "../../types";

/**
 * 登録表にキーがあるか（同期。サービスは読み込まない）
 */
export function hasService(registry: DomainRegistry, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, key);
}

/**
 * ドメイン名からサービスを取得する（遅延読み込み）
 *
 * @param registry 登録表（serviceRegistry）
 * @param key ドメインキー（camelCase。例: "sample", "user"）
 * @returns サービス。未登録なら undefined。読み込み失敗は throw
 *
 * @example
 * const service = await getService<typeof sampleService>(serviceRegistry, "sample");
 * const result = await service?.list();
 */
export async function getService<T extends DomainService = DomainService>(
  registry: DomainRegistry,
  key: string,
): Promise<T | undefined> {
  const entry = hasService(registry, key) ? registry[key] : undefined;
  if (!entry) return undefined;
  return (await entry.service()) as T;
}

/**
 * ドメイン名からサービスを取得する（未登録なら throw）
 */
export async function getServiceOrThrow<T extends DomainService = DomainService>(
  registry: DomainRegistry,
  key: string,
): Promise<T> {
  const service = await getService<T>(registry, key);
  if (!service) {
    throw new Error(`Service not found: ${key}`);
  }
  return service;
}

/**
 * ドメイン名からサービスを引き、引けない理由を状態で返す（throw しない）。
 * 「未登録」「読み込み失敗」「求めた操作が無い」を「行なし」と区別したい呼び手
 * （ストレージ台帳の照合など）が使う。
 *
 * @param options.require 求める操作名。1 つでも無ければ status "unsupported"
 */
export async function lookupDomainService<T extends DomainService = DomainService>(
  registry: DomainRegistry,
  key: string,
  options: { require?: ReadonlyArray<keyof DomainService> } = {},
): Promise<DomainServiceLookup<T>> {
  if (!hasService(registry, key)) return { status: "unregistered" };
  let service: DomainService;
  try {
    service = await registry[key].service();
  } catch (error) {
    return { status: "load_failed", error };
  }
  if (!service || typeof service !== "object") {
    return { status: "load_failed", error: new Error(`domainEntry "${key}" の service がオブジェクトを返しませんでした`) };
  }
  const missing = (options.require ?? []).filter((name) => typeof service[name] !== "function");
  if (missing.length > 0) return { status: "unsupported", missing };
  return { status: "found", service: service as T };
}
