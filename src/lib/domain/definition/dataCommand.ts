// src/lib/domain/definition/dataCommand.ts
// 全ドメイン共通のデータ操作のコマンド(pnpm ops data export|import|update|delete <domain>)の許可と、呼ぶサービスの関数を決める(D72)。
// - 許可: 対応する API の操作(export → export、import → import、update → bulkUpdate、delete → bulkDeleteByIds)を resolveAccessRule で解き、
//   "none" でなければ許す(管理 API で何かしらのロールに許した操作はコマンドでも許す)。access.commands の allow / deny が優先
// - fail-closed: 許可されても、そのドメインのサービスに関数が無ければ止める(lib/crud を直接呼ばない)
// - 登録表で引けること(getService)は許可ではない。INTERNAL_ONLY のドメインは 4 つとも閉じる
// README.md「データ操作のコマンド(pnpm ops data)の許可」

import type { DataCommand, DomainApiAccessConfig, DomainApiOperation } from "../types/apiAccess";
import { DATA_COMMANDS } from "../types/apiAccess";
import { resolveAccessRule } from "./apiAccess";

/** コマンド → 規則を引く API の操作と、呼ぶサービスの関数 */
export const DATA_COMMAND_OPERATIONS: Readonly<Record<DataCommand, { operation: DomainApiOperation; type: "read" | "write"; method: string }>> = {
  export: { operation: "export", type: "read", method: "search" },
  import: { operation: "import", type: "write", method: "bulkUpsert" },
  update: { operation: "bulkUpdate", type: "write", method: "bulkUpdate" },
  delete: { operation: "bulkDeleteByIds", type: "write", method: "bulkDeleteByIds" },
};

export type DataCommandResolution = { allowed: true; method: string } | { allowed: false; why: string };

export const isDataCommand = (value: string): value is DataCommand => (DATA_COMMANDS as readonly string[]).includes(value);

/**
 * データ操作のコマンドを許すか、許すならサービスのどの関数を呼ぶか。
 * @param access そのドメインの access(登録表の domainEntry)
 * @param service そのドメインのサービス(関数を持つかだけ見る。呼ばない)
 */
export function resolveDataCommand(access: DomainApiAccessConfig, command: DataCommand, service: object | null | undefined): DataCommandResolution {
  const { operation, type, method } = DATA_COMMAND_OPERATIONS[command];
  const override = access.commands?.[command];
  if (override === "deny") return { allowed: false, why: `access.commands.${command} = "deny"(このドメインはコマンドで ${command} しない)` };
  if (override !== "allow") {
    const rule = resolveAccessRule(access, operation, type);
    if (rule === "none") return { allowed: false, why: `管理 API の ${operation} が "none"(どのロールにも許していない)。コマンドでも許すなら access.commands.${command} = "allow"` };
  }
  const fn = service ? (service as Record<string, unknown>)[method] : undefined;
  if (typeof fn !== "function") return { allowed: false, why: `サービスに ${method} がありません(サービスに無い操作はしない)` };
  return { allowed: true, method };
}
