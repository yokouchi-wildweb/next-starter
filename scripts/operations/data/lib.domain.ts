// scripts/operations/data/lib.domain.ts
// ドメイン名から登録表のサービスと access を引き、データ操作のコマンドを許すかを resolveDataCommand(src/lib/domain)で決める。
// 許されない・サービスに無い・知らないドメインは理由を出して止める(lib/crud を直接呼ばない。登録表で引けることは許可ではない)。
// @/wiring は動的 import だけ(lint scripts-no-static-wiring)

import type { DataCommand } from "@/lib/domain/types";

import { DataUsageError } from "./lib.args";

export type ResolvedDataTarget = {
  domain: string;
  /** そのドメインのサービス(呼ぶ関数は method) */
  service: Record<string, (...args: unknown[]) => Promise<unknown>>;
  method: string;
  /**
   * 一括の書き込みで運べない項目 = メディア(ファイル)の列と集まり(mediaCollection 等の子)。import / update は書かない
   * (ファイルは storage の binding を通す。運ぶなら管理画面のデータ移行の ZIP)
   */
  mediaFields: string[];
};

const camelOf = (name: string): string => name.replace(/[-_]([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** ドメインを引いて、コマンドを許すか決める。許さなければ DataUsageError(何もしていない) */
export async function resolveDataTarget(domainName: string, command: DataCommand): Promise<ResolvedDataTarget> {
  const { getDomainAccess, getService, hasService } = await import("@/wiring/domainRegistry");
  const { resolveDataCommand } = await import("@/lib/domain");
  const domain = hasService(domainName) ? domainName : camelOf(domainName);
  const access = getDomainAccess(domain);
  if (!access || !hasService(domain)) throw new DataUsageError(`知らないドメインです: ${domainName}(登録表 src/registry/serviceRegistry.ts のキー)`);
  const service = await getService(domain);
  const resolution = resolveDataCommand(access, command, service);
  if (!resolution.allowed) throw new DataUsageError(`${domain} で ${command} はできません: ${resolution.why}`);
  const { getDomainConfig, hasDomainConfig } = await import("@/wiring/domainConfig");
  const { collectMediaFields, isCollectionFieldType } = await import("@/lib/domain/fields/fieldTypes.mjs");
  const config = hasDomainConfig(domain) ? (getDomainConfig(domain) as unknown as { fields?: Array<{ name: string; fieldType: string }> }) : null;
  const mediaFields = config
    ? [...collectMediaFields(config as never).map((f: { name: string }) => f.name), ...(config.fields ?? []).filter((f) => isCollectionFieldType(f.fieldType)).map((f) => f.name)]
    : [];
  return { domain, service: service as unknown as ResolvedDataTarget["service"], method: resolution.method, mediaFields };
}
