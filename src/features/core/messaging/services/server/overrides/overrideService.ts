// src/features/core/messaging/services/server/overrides/overrideService.ts
//
// 管理画面の文言の上書き(D21・D24・D28)の管理の service。/api/admin/messaging/overrides が呼ぶ。
// - 一覧: 生成の一覧の連絡のうち、fork の override を重ねた後に adminEditable がある(か行が残る)連絡
// - 1 件: 欄ごとに コードの値・管理画面の値・送る時の値・印(直した / コードが変わった / 孤立)と使ってよい {{鍵}}
// - 保存: 送る口と同じ検査(lib/messaging checkAdminFieldValue)を通った値だけ。直した時のコードの値も残す
// - 既定に戻す = 行を消す。保存と戻すは監査に残す(messaging.override.updated / .reset、値は残さない)
// - service でも管理者を確かめる(D42)

import { isDeepStrictEqual } from "node:util";

import { z } from "zod";

import {
  adminFieldAllowedKeys,
  adminFieldCodeValue,
  checkAdminFieldValue,
  type AdminFieldCheckOptions,
} from "@/lib/messaging";
import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import type { AnyResolvedMessageDefinition } from "../sendMessage/definition";
import { assertAdminActor, type AdminCheckDeps } from "../admin/assertAdmin";
import type {
  AdminOverrideField,
  AdminOverrideMessageDetail,
  AdminOverrideMessageSummary,
} from "./dto";
import type { MessageOverrideRecord, MessageOverrideStore } from "./types";

export type OverrideServiceDeps = AdminCheckDeps & {
  store: MessageOverrideStore;
  /** 生成の一覧の連絡の鍵 */
  messageKeys: () => string[];
  /** 連絡の定義(fork の override を重ねた後、管理画面の値は重ねない)と検査の束。無い・読めない連絡は null */
  loadDefinition: (
    messageKey: string,
  ) => Promise<{ resolved: AnyResolvedMessageDefinition; check: AdminFieldCheckOptions } | null>;
  recordAudit: (input: AuditRecordInput) => Promise<unknown>;
};

export const SaveMessageOverrideInputSchema = z
  .object({ fieldPath: z.string().min(1).max(200), value: z.unknown() })
  .strict();

function buildFields(
  resolved: AnyResolvedMessageDefinition,
  check: AdminFieldCheckOptions,
  rows: readonly MessageOverrideRecord[],
): AdminOverrideField[] {
  const editable = (resolved.adminEditable ?? []).map(String);
  const paths = [...editable, ...rows.map((row) => row.fieldPath).filter((path) => !editable.includes(path))];
  return paths.map((path) => {
    const row = rows.find((item) => item.fieldPath === path);
    const codeValue = adminFieldCodeValue(resolved, path) ?? null;
    const problem = row ? checkAdminFieldValue(resolved, path, row.value, check) : null;
    return {
      path,
      editable: editable.includes(path),
      codeValue,
      value: row ? row.value : null,
      effective: row && !problem ? row.value : codeValue,
      edited: Boolean(row),
      codeChanged: Boolean(row) && !isDeepStrictEqual(row!.codeValue ?? null, codeValue),
      orphan: Boolean(problem),
      problem: problem?.message ?? null,
      updatedAt: row ? row.updatedAt.toISOString() : null,
    };
  });
}

export function createOverrideService(deps: OverrideServiceDeps) {
  async function requireDefinition(messageKey: string) {
    const loaded = await deps.loadDefinition(messageKey);
    if (!loaded) throw new DomainError(`連絡 ${messageKey} はありません`, { status: 404 });
    return loaded;
  }

  async function detail(messageKey: string): Promise<AdminOverrideMessageDetail> {
    const { resolved, check } = await requireDefinition(messageKey);
    const rows = await deps.store.listByMessage(messageKey);
    if (!resolved.adminEditable?.length && rows.length === 0) {
      throw new DomainError(`連絡 ${messageKey} は管理画面で直せません`, { status: 404 });
    }
    return {
      key: resolved.key,
      kind: resolved.kind,
      category: resolved.category,
      allowedKeys: adminFieldAllowedKeys(resolved, check.variableKeys),
      fields: buildFields(resolved, check, rows),
    };
  }

  return {
    /** 編集できる連絡の一覧 */
    async listMessages(): Promise<AdminOverrideMessageSummary[]> {
      await assertAdminActor(deps);
      const rows = await deps.store.listAll();
      const summaries: AdminOverrideMessageSummary[] = [];
      for (const key of deps.messageKeys()) {
        const loaded = await deps.loadDefinition(key);
        if (!loaded) continue;
        const own = rows.filter((row) => row.messageKey === key);
        if (!loaded.resolved.adminEditable?.length && own.length === 0) continue;
        const fields = buildFields(loaded.resolved, loaded.check, own);
        summaries.push({
          key,
          kind: loaded.resolved.kind,
          category: loaded.resolved.category,
          editableCount: fields.filter((field) => field.editable).length,
          editedCount: fields.filter((field) => field.edited).length,
          orphanCount: fields.filter((field) => field.orphan).length,
          codeChangedCount: fields.filter((field) => field.codeChanged).length,
        });
      }
      return summaries;
    },

    /** 1 連絡の全欄 */
    async getMessage(messageKey: string): Promise<AdminOverrideMessageDetail> {
      await assertAdminActor(deps);
      return detail(messageKey);
    },

    /**
     * 欄 1 つを保存する(送る口と同じ検査)。
     * @throws DomainError(400) 入力・検査の誤り / (403) 管理者でない / (404) 連絡が無い
     */
    async saveField(messageKey: string, input: unknown): Promise<AdminOverrideMessageDetail> {
      await assertAdminActor(deps);
      const parsed = SaveMessageOverrideInputSchema.safeParse(input);
      if (!parsed.success) throw new DomainError("文言の入力が正しくありません", { status: 400 });
      const { fieldPath, value } = parsed.data;
      const { resolved, check } = await requireDefinition(messageKey);
      const problem = checkAdminFieldValue(resolved, fieldPath, value, check);
      if (problem) throw new DomainError(problem.message, { status: 400 });
      await deps.store.upsert({
        messageKey,
        fieldPath,
        value,
        codeValue: adminFieldCodeValue(resolved, fieldPath) ?? null,
        updatedBy: deps.context()?.actorId ?? null,
      });
      await deps.recordAudit({
        targetType: "message_override",
        targetId: `${messageKey}:${fieldPath}`,
        action: "messaging.override.updated",
        metadata: { messageKey, fieldPath },
      });
      return detail(messageKey);
    },

    /**
     * 欄 1 つを既定(コードの値)に戻す = 行を消す。
     * @throws DomainError(403) 管理者でない / (404) 連絡か行が無い
     */
    async resetField(messageKey: string, fieldPath: string): Promise<AdminOverrideMessageDetail> {
      await assertAdminActor(deps);
      await requireDefinition(messageKey);
      const removed = await deps.store.remove(messageKey, fieldPath);
      if (!removed) throw new DomainError(`${messageKey} ${fieldPath} は直していません`, { status: 404 });
      await deps.recordAudit({
        targetType: "message_override",
        targetId: `${messageKey}:${fieldPath}`,
        action: "messaging.override.reset",
        metadata: { messageKey, fieldPath },
      });
      return detail(messageKey);
    },
  };
}

export type OverrideService = ReturnType<typeof createOverrideService>;
