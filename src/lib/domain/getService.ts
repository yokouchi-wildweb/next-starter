// src/lib/domain/getService.ts

import "server-only";
import { serviceRegistry } from "@/registry/serviceRegistry";

/**
 * ドメイン名からサービスを取得する
 *
 * @param domain - ドメイン名（例: "sample", "user"）
 * @returns サービスインスタンス。存在しない場合は undefined
 *
 * @example
 * const service = getService<typeof sampleService>("sample");
 * const result = await service?.list();
 */
export function getService<T = unknown>(domain: string): T | undefined {
  return serviceRegistry[domain] as T | undefined;
}

/**
 * ドメイン名からサービスを取得する（存在しない場合はエラー）
 *
 * @param domain - ドメイン名
 * @returns サービスインスタンス
 * @throws ドメインが存在しない場合
 */
export function getServiceOrThrow<T = unknown>(domain: string): T {
  const service = serviceRegistry[domain] as T | undefined;
  if (!service) {
    throw new Error(`Service not found: ${domain}`);
  }
  return service;
}
