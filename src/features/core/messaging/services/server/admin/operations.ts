// src/features/core/messaging/services/server/admin/operations.ts
//
// 管理の操作(D39・D42・D88): 削除・失敗の再送(続きを送るは continueSending.ts)。service でも管理者を確かめ、監査ログに 1 行ずつ。
// - 削除(delete、D88。取り消し・取り下げを置き換えた): どの状態の回も消せる(論理削除 deleted_at)。回の行を排他で持った取引で
//   未送信の配達を canceled・送り直しの予定を止め、展開を止めて deleted_at を書く(status は変えない。予約の回も cron が拾わない)。
//   commit の後に消せる経路(経路の項目の remove、D89。上流は inApp = お知らせの行・共有の行・画像)を呼ぶ。送ったメール・LINE は残る。
//   削除済みの回をもう一度消すと remove だけを呼び直す(同じ結果、監査は書かない)。経路の remove の失敗は結果に残す(もう一度消せば呼び直す)
// - まとめて削除(bulk): 1 回の要求で 100 件まで、回ごとに同じ削除(回ごとの取引)、回ごとの結果
// - 削除の見込み(summary): 確認の画面のため、選んだ回の経路ごとの送れた数(消せる経路か)・未送信の数・予約の数
// - 失敗の再送(resend): required でない回の failed の配達を送り直す。unknown は includeUnknown の時だけ(二重の可能性を回に残す)。
//   - 本文を残す連絡(record vars / full): 同じ回のまま配達の行を queued に戻す(同じ冪等の鍵 = 配達の id のまま)。
//     cron(か続きを送る)が lease で取って送るので、cron と再送が同じ宛先を二重に送らない
//   - record meta の連絡: 同じ回では送り直さず、回の vars(元の入力の写し)で失敗の宛先へ新しい回として送る。写しが無ければ 409
//   - 秘密を差し込む連絡: 秘密の値を残さないので常に 409(送り手のコードからもう一度送る)。required の連絡も 409
//   - 削除済み・取り消し済み・予約のままの回は 409

import { z } from "zod";

import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import type { MessageChannel } from "@/lib/messaging";

import type { MessageDispatch } from "../../../entities/model";
import { MESSAGE_EXPAND_DONE } from "../../../entities/schema";
import type { AnyResolvedMessageDefinition } from "../sendMessage/definition";
import { recordPolicyOf } from "../sendMessage/record";
import type { MessageDispatchAuthored, MessageRecipient, SendMessageResult, SendMessageToManyInput } from "../sendMessage/types";
import { assertAdminActor, type AdminCheckDeps } from "./assertAdmin";
import type { MessageOperationsStore } from "./operationsTypes";
import {
  DISPATCH_OPERATION_REASON_TEXT,
  type DispatchOperationReason,
} from "../../../constants/dispatchOperations";

/** 操作ができない理由の符号と文は constants/dispatchOperations.ts(画面の部品と同じ物) */
export type { DispatchOperationReason };

export type DispatchOperationFlag = { allowed: boolean; reason: DispatchOperationReason | null };

export type DispatchOperationFlags = {
  /** 削除(削除済みは false = reason deleted。service は削除済みにも同じ結果を返す) */
  canDelete: DispatchOperationFlag;
  /** 失敗の再送。mode = 同じ回で送り直す(requeue)か新しい回として送る(new_dispatch) */
  canResend: DispatchOperationFlag & { mode: "requeue" | "new_dispatch" | null; failed: number; unknown: number };
  /** 続きを送る(送信中の回だけ) */
  canContinue: DispatchOperationFlag;
};

/** 回の連絡の性質(定義が読めなければ null) */
export type DispatchPolicy = { required: boolean; secret: boolean; record: string } | null;


function refuse(reason: DispatchOperationReason): never {
  throw new DomainError(DISPATCH_OPERATION_REASON_TEXT[reason], { status: reason === "not_found" ? 404 : 409, code: reason });
}

const ok: DispatchOperationFlag = { allowed: true, reason: null };
const no = (reason: DispatchOperationReason): DispatchOperationFlag => ({ allowed: false, reason });

/** 3 つの操作ができるか(画面のボタンと service の両方が使う同じ判定) */
export function operationFlags(
  dispatch: Pick<MessageDispatch, "status" | "deleted_at" | "record" | "vars" | "values">,
  policy: DispatchPolicy,
  counts: { failed: number; unknown: number },
  options: { includeUnknown?: boolean } = {},
): DispatchOperationFlags {
  const deleted = Boolean(dispatch.deleted_at);
  const scheduled = dispatch.status === "scheduled";
  const canDelete = deleted ? no("deleted") : ok;
  const canContinue = deleted ? no("deleted") : dispatch.status === "processing" ? ok : no("not_processing");

  const targets = counts.failed + (options.includeUnknown === false ? 0 : counts.unknown);
  let resendFlag: DispatchOperationFlag;
  let mode: "requeue" | "new_dispatch" | null = null;
  if (deleted) resendFlag = no("deleted");
  else if (dispatch.status === "cancelled") resendFlag = no("cancelled");
  else if (scheduled) resendFlag = no("scheduled");
  else if (!policy) resendFlag = no("definition_missing");
  else if (policy.required) resendFlag = no("required");
  else if (policy.secret) resendFlag = no("secret");
  else if (targets === 0) resendFlag = no("no_failed");
  else if (policy.record === "meta") {
    // 新しい回は回の vars と欄の中身から描く(閉じた回は両方消えている)
    const copied = Boolean(dispatch.vars && dispatch.values);
    resendFlag = copied ? ok : no("no_input_copy");
    mode = copied ? "new_dispatch" : null;
  } else {
    resendFlag = ok;
    mode = "requeue";
  }
  return { canDelete, canContinue, canResend: { ...resendFlag, mode, failed: counts.failed, unknown: counts.unknown } };
}

/** 回の連絡の性質(required・秘密・本文の残し方) */
export function policyOf(resolved: AnyResolvedMessageDefinition | null, dispatch: Pick<MessageDispatch, "record">): DispatchPolicy {
  if (!resolved) return null;
  const policy = recordPolicyOf({ ...resolved, record: dispatch.record ?? resolved.record });
  return { required: Boolean(resolved.required), secret: policy.secretKeys.length > 0, record: policy.record };
}

export type AdminOperationsDeps<Tx> = AdminCheckDeps & {
  store: MessageOperationsStore<Tx>;
  now: () => Date;
  /** 経路の受け口の項目(削除が remove を呼び、見込みが消せる経路かを読む) */
  channels: () => readonly MessageChannel[];
  /** 回の定義(読めなければ null)。テンプレートの回は固定した版 */
  definitionOf: (dispatch: MessageDispatch) => Promise<AnyResolvedMessageDefinition | null>;
  /** 組み済みの定義で新しい回を送る(record meta の再送) */
  sendResolved: (
    resolved: AnyResolvedMessageDefinition,
    input: SendMessageToManyInput,
    authored?: MessageDispatchAuthored,
  ) => Promise<SendMessageResult>;
  /** 戻した行を 1 束だけ送る(失敗しても再送は成り立つ。残りは cron) */
  continueSending: (dispatchId: string) => Promise<unknown>;
  recordAudit: (input: AuditRecordInput) => Promise<unknown>;
};

export const AdminResendInputSchema = z.object({ includeUnknown: z.boolean().optional() }).strict();

/** まとめて削除・削除の見込みの 1 回の要求の上限 */
export const ADMIN_DELETE_MAX_IDS = 100;

export const AdminDispatchIdsInputSchema = z
  .object({ ids: z.array(z.string().uuid()).min(1).max(ADMIN_DELETE_MAX_IDS) })
  .strict();

export type AdminDeleteResult = {
  dispatchId: string;
  /** もう削除してあった(remove だけを呼び直した) */
  alreadyDeleted: boolean;
  /** 止めた未送信の配達の数 */
  canceledDeliveries: number;
  /** 消せる経路ごとに消した数 */
  removed: { channel: string; removed: number }[];
  /** remove が失敗した経路(もう一度削除すると呼び直す) */
  failedChannels: { channel: string; message: string }[];
};

export type AdminBulkDeleteResult = {
  results: ({ dispatchId: string; ok: true; result: AdminDeleteResult } | { dispatchId: string; ok: false; reason: string; message: string })[];
};

export type AdminDeleteSummary = {
  /** 見つかった回の数(無い id は数えない) */
  found: number;
  /** もう削除してある回の数 */
  deleted: number;
  /** 予約のままの回の数(削除すると送られない) */
  scheduled: number;
  /** 未送信の配達の数(削除で止まる) */
  unsent: number;
  /** 経路ごとの送れた数。removable = 経路が remove を持つ(削除で受け取った人から消える)/ false = 届いた物は残る */
  channels: { key: string; label: string; removable: boolean; sent: number }[];
  /** 全員・ロール宛ての共有のお知らせの行を持つ回の数(配達の行が無い分。inApp が消せれば消える) */
  sharedInbox: number;
};

export type AdminResendResult = {
  dispatchId: string;
  mode: "requeue" | "new_dispatch";
  failed: number;
  unknown: number;
  /** 新しい回として送った時の回の id */
  newDispatchId: string | null;
};

function metadataOf(dispatch: MessageDispatch): Record<string, unknown> {
  return { ...((dispatch.metadata as Record<string, unknown> | null) ?? {}) };
}

async function deleteOne<Tx>(deps: AdminOperationsDeps<Tx>, dispatchId: string): Promise<AdminDeleteResult> {
  const marked = await deps.store.withLockedDispatch(dispatchId, async (tx, dispatch) => {
    if (!dispatch) refuse("not_found");
    if (dispatch.deleted_at) return { alreadyDeleted: true, canceledDeliveries: 0 };
    const now = deps.now();
    const canceledDeliveries = await deps.store.cancelUnsent(tx, dispatchId, now);
    await deps.store.updateDispatch(tx, dispatchId, {
      deleted_at: now,
      // 展開を止める(削除の後にお知らせの行・配達を作らない)
      expand_cursor: MESSAGE_EXPAND_DONE,
      updatedAt: now,
    });
    return { alreadyDeleted: false, canceledDeliveries };
  });
  const removed: AdminDeleteResult["removed"] = [];
  const failedChannels: AdminDeleteResult["failedChannels"] = [];
  for (const channel of deps.channels()) {
    if (!channel.remove) continue;
    try {
      removed.push({ channel: channel.key, removed: (await channel.remove({ dispatchId })).removed });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[messaging] 削除した回の ${channel.key} を消せませんでした(${dispatchId}): ${message}`);
      failedChannels.push({ channel: channel.key, message });
    }
  }
  const result: AdminDeleteResult = { dispatchId, ...marked, removed, failedChannels };
  if (!marked.alreadyDeleted) {
    await deps.recordAudit({
      targetType: "message_dispatch",
      targetId: dispatchId,
      action: "messaging.dispatch.deleted",
      metadata: {
        canceledDeliveries: result.canceledDeliveries,
        removed: Object.fromEntries(removed.map((item) => [item.channel, item.removed])),
        failedChannels: failedChannels.map((item) => item.channel),
      },
    });
  }
  return result;
}

/**
 * 回を削除する(どの状態でも。削除済みは remove だけを呼び直す)。
 * @throws DomainError(404) 回が無い / (403) 管理者でない
 */
export async function adminDeleteDispatch<Tx>(deps: AdminOperationsDeps<Tx>, dispatchId: string): Promise<AdminDeleteResult> {
  await assertAdminActor(deps);
  return deleteOne(deps, dispatchId);
}

/**
 * 回をまとめて削除する(100 件まで、回ごとに同じ削除・回ごとの結果)。
 * @throws DomainError(400) 入力 / (403) 管理者でない
 */
export async function adminBulkDeleteDispatches<Tx>(deps: AdminOperationsDeps<Tx>, rawInput: unknown): Promise<AdminBulkDeleteResult> {
  await assertAdminActor(deps);
  const parsed = AdminDispatchIdsInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new DomainError(`削除する送信は 1〜${ADMIN_DELETE_MAX_IDS} 件の id で指定してください`, { status: 400 });
  const results: AdminBulkDeleteResult["results"] = [];
  for (const dispatchId of [...new Set(parsed.data.ids)]) {
    try {
      results.push({ dispatchId, ok: true, result: await deleteOne(deps, dispatchId) });
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      results.push({ dispatchId, ok: false, reason: String(error.code ?? "error"), message: error.message });
    }
  }
  return { results };
}

/**
 * 削除の見込み(確認の画面)。
 * @throws DomainError(400) 入力 / (403) 管理者でない
 */
export async function adminDispatchDeleteSummary<Tx>(deps: AdminOperationsDeps<Tx>, rawInput: unknown): Promise<AdminDeleteSummary> {
  await assertAdminActor(deps);
  const parsed = AdminDispatchIdsInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new DomainError(`見込みを出す送信は 1〜${ADMIN_DELETE_MAX_IDS} 件の id で指定してください`, { status: 400 });
  const ids = [...new Set(parsed.data.ids)];
  const dispatches = await deps.store.findDispatches(ids);
  const live = dispatches.filter((dispatch) => !dispatch.deleted_at).map((dispatch) => dispatch.id);
  const counts = await deps.store.deliveryCounts(live);
  const items = deps.channels();
  const keys = [...new Set([...items.map((channel) => channel.key), ...counts.map((row) => row.channel)])];
  return {
    found: dispatches.length,
    deleted: dispatches.length - live.length,
    scheduled: dispatches.filter((dispatch) => !dispatch.deleted_at && dispatch.status === "scheduled").length,
    unsent: counts.filter((row) => row.status === "queued" || row.status === "sending").reduce((sum, row) => sum + row.count, 0),
    channels: keys.map((key) => {
      const channel = items.find((item) => item.key === key);
      return {
        key,
        label: channel?.label ?? key,
        removable: Boolean(channel?.remove),
        sent: counts.filter((row) => row.channel === key && row.status === "sent").reduce((sum, row) => sum + row.count, 0),
      };
    }),
    sharedInbox: await deps.store.countSharedInbox(live),
  };
}

/**
 * 失敗の再送。
 * @throws DomainError(400) 入力 / (404) 回が無い / (409) 送り直せない(理由つき) / (403) 管理者でない
 */
export async function adminResendFailed<Tx>(
  deps: AdminOperationsDeps<Tx>,
  dispatchId: string,
  rawInput: unknown = {},
): Promise<AdminResendResult> {
  await assertAdminActor(deps);
  const parsed = AdminResendInputSchema.safeParse(rawInput ?? {});
  if (!parsed.success) throw new DomainError("再送の指定が正しくありません", { status: 400 });
  const includeUnknown = parsed.data.includeUnknown ?? false;

  const planned = await deps.store.withLockedDispatch(dispatchId, async (tx, dispatch) => {
    if (!dispatch) refuse("not_found");
    const resolved = await deps.definitionOf(dispatch);
    const counts = await deps.store.countFailed(tx, dispatchId);
    const flag = operationFlags(dispatch, policyOf(resolved, dispatch), counts, { includeUnknown }).canResend;
    if (!flag.allowed) refuse(flag.reason!);
    const now = deps.now();
    const metadata = metadataOf(dispatch);
    const history = Array.isArray(metadata.resends) ? [...(metadata.resends as unknown[])] : [];

    if (flag.mode === "requeue") {
      const requeued = await deps.store.requeueFailed(tx, dispatchId, { includeUnknown, now });
      if (requeued.failed + requeued.unknown === 0) refuse("no_failed");
      history.push({ at: now.toISOString(), mode: "requeue", ...requeued, includeUnknown });
      await deps.store.updateDispatch(tx, dispatchId, {
        status: "processing",
        completed_at: null,
        metadata: { ...metadata, resends: history, ...(requeued.unknown > 0 ? { possibleDuplicate: true } : {}) },
        updatedAt: now,
      });
      return { kind: "requeue" as const, ...requeued };
    }

    // 新しい回として送る(record meta、元の入力の写し = 回の vars)
    const resentIds = Array.isArray(metadata.resentDeliveryIds) ? (metadata.resentDeliveryIds as string[]) : [];
    const rows = await deps.store.listFailed(tx, dispatchId, { includeUnknown, excludeIds: resentIds });
    if (rows.length === 0) refuse("no_failed");
    const recipients: MessageRecipient[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.recipientKey)) continue;
      seen.add(row.recipientKey);
      if (row.userId) recipients.push({ userId: row.userId });
      else if (row.address) recipients.push({ channel: row.channel, address: row.address });
    }
    const channels = [...new Set(rows.map((row) => row.channel))];
    const sent = await deps.sendResolved(
      resolved!,
      {
        recipients,
        vars: dispatch.vars as Record<string, unknown>,
        channels,
        source: dispatch.source,
        reason: dispatch.reason ?? undefined,
        metadata: { resendOf: dispatchId, ...(includeUnknown ? { possibleDuplicate: true } : {}) },
        isTest: dispatch.is_test ?? false,
      } as SendMessageToManyInput,
      // 定義は回の欄の中身から組んである(D128)。テンプレートの回の再送は同じ版と直した印を残す
      dispatch.template_id && dispatch.template_version
        ? { template: { id: dispatch.template_id, version: dispatch.template_version, edited: dispatch.template_edited } }
        : undefined,
    );
    const failed = rows.filter((row) => row.status === "failed").length;
    const unknown = rows.length - failed;
    history.push({ at: now.toISOString(), mode: "new_dispatch", failed, unknown, includeUnknown, dispatchId: sent.dispatchId });
    await deps.store.updateDispatch(tx, dispatchId, {
      metadata: {
        ...metadata,
        resends: history,
        resentDeliveryIds: [...resentIds, ...rows.map((row) => row.id)],
        ...(unknown > 0 ? { possibleDuplicate: true } : {}),
      },
      updatedAt: now,
    });
    return { kind: "new_dispatch" as const, failed, unknown, newDispatchId: sent.dispatchId };
  });

  if (planned.kind === "requeue") {
    // 戻した行を 1 束だけ今送る(lease で取るので cron と重ならない。失敗は cron が拾う)
    try {
      await deps.continueSending(dispatchId);
    } catch (error) {
      console.warn(`[messaging] 再送の最初の束を送れませんでした(${dispatchId}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const result: AdminResendResult = {
    dispatchId,
    mode: planned.kind,
    failed: planned.failed,
    unknown: planned.unknown,
    newDispatchId: planned.kind === "new_dispatch" ? planned.newDispatchId : null,
  };
  await deps.recordAudit({
    targetType: "message_dispatch",
    targetId: dispatchId,
    action: "messaging.dispatch.resent",
    metadata: { mode: result.mode, failed: result.failed, unknown: result.unknown, includeUnknown, newDispatchId: result.newDispatchId },
  });
  return result;
}
