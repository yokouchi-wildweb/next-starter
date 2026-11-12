// src/features/core/messaging/services/server/admin/operations.ts
//
// 管理の操作(D39・D42): 予約の取り消し・取り下げ・失敗の再送。service でも管理者を確かめ、監査ログに 1 行ずつ。
// - 取り消し(cancel): 予約(status scheduled)でまだ展開していない回だけ cancelled に。他は 409
// - 取り下げ(retract): 回のお知らせの行(共有の 1 行と受信者ごとの行)を消し、未送信の配達を canceled、送り直しの予定も止め、
//   回の展開も止めて retracted_at を書く。回の status は変えない。画像は保持の掃除と同じく台帳から外す。
//   予約のままの回は 409(取り消しを使う)。2 回目は 409。送ったメールは取り戻せない(受け取り箱だけ)
// - 失敗の再送(resend): required でない回の failed の配達を送り直す。unknown は includeUnknown の時だけ(二重の可能性を回に残す)。
//   - 本文を残す連絡(record vars / full): 同じ回のまま配達の行を queued に戻す(同じ冪等の鍵 = 配達の id のまま)。
//     cron(か続きを送る)が lease で取って送るので、cron と再送が同じ宛先を二重に送らない
//   - record meta の連絡: 同じ回では送り直さず、回の vars(元の入力の写し)で失敗の宛先へ新しい回として送る。写しが無ければ 409
//   - 秘密を差し込む連絡: 秘密の値を残さないので常に 409(送り手のコードからもう一度送る)。required の連絡も 409
//   - 取り下げ・取り消し済み・予約のままの回は 409

import { z } from "zod";

import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import type { MessageDispatch } from "../../../entities/model";
import { MESSAGE_EXPAND_DONE } from "../../../entities/schema";
import type { AnyResolvedMessageDefinition } from "../sendMessage/definition";
import { boundInboxImageRefs, INBOX_IMAGES_METADATA_KEY } from "../inbox/imageBinding";
import { recordPolicyOf } from "../sendMessage/record";
import type { MessageRecipient, SendMessageResult, SendMessageToManyInput } from "../sendMessage/types";
import { assertAdminActor, type AdminCheckDeps } from "./assertAdmin";
import type { MessageOperationsStore } from "./operationsTypes";

/** 操作ができない理由の符号(画面が理由を出す) */
export type DispatchOperationReason =
  | "not_found"
  | "not_scheduled"
  | "already_started"
  | "scheduled_use_cancel"
  | "cancelled"
  | "retracted"
  | "scheduled"
  | "definition_missing"
  | "required"
  | "secret"
  | "no_failed"
  | "no_input_copy";

export type DispatchOperationFlag = { allowed: boolean; reason: DispatchOperationReason | null };

export type DispatchOperationFlags = {
  cancel: DispatchOperationFlag;
  retract: DispatchOperationFlag;
  /** mode = 同じ回で送り直す(requeue)か新しい回として送る(new_dispatch) */
  resend: DispatchOperationFlag & { mode: "requeue" | "new_dispatch" | null; failed: number; unknown: number };
};

/** 回の連絡の性質(定義が読めなければ null) */
export type DispatchPolicy = { required: boolean; secret: boolean; record: string } | null;

const REASON_TEXT: Record<DispatchOperationReason, string> = {
  not_found: "回がありません",
  not_scheduled: "予約の回ではありません",
  already_started: "もう送り始めています",
  scheduled_use_cancel: "まだ送っていない予約の回は取り消しを使ってください",
  cancelled: "取り消した回です",
  retracted: "取り下げた回です",
  scheduled: "まだ送っていない予約の回です",
  definition_missing: "回の連絡の定義を読めません",
  required: "止められない連絡(required)は送り直せません",
  secret: "秘密の値を差し込む連絡は秘密を残さないので送り直せません。送り手の処理からもう一度送ってください",
  no_failed: "送り直す失敗の宛先がありません",
  no_input_copy: "本文を残さない連絡で、元の入力の写しがもう無いので送り直せません。新しい回として送ってください",
};

function refuse(reason: DispatchOperationReason): never {
  throw new DomainError(REASON_TEXT[reason], { status: reason === "not_found" ? 404 : 409, code: reason });
}

const ok: DispatchOperationFlag = { allowed: true, reason: null };
const no = (reason: DispatchOperationReason): DispatchOperationFlag => ({ allowed: false, reason });

/** 3 つの操作ができるか(画面のボタンと service の両方が使う同じ判定) */
export function operationFlags(
  dispatch: Pick<MessageDispatch, "status" | "expand_cursor" | "retracted_at" | "record" | "vars">,
  policy: DispatchPolicy,
  counts: { failed: number; unknown: number },
  options: { includeUnknown?: boolean } = {},
): DispatchOperationFlags {
  const scheduled = dispatch.status === "scheduled";
  const cancel = !scheduled ? no("not_scheduled") : dispatch.expand_cursor !== null ? no("already_started") : ok;

  const retract = dispatch.retracted_at
    ? no("retracted")
    : dispatch.status === "cancelled"
      ? no("cancelled")
      : scheduled
        ? no("scheduled_use_cancel")
        : ok;

  const targets = counts.failed + (options.includeUnknown === false ? 0 : counts.unknown);
  let resendFlag: DispatchOperationFlag;
  let mode: "requeue" | "new_dispatch" | null = null;
  if (dispatch.retracted_at) resendFlag = no("retracted");
  else if (dispatch.status === "cancelled") resendFlag = no("cancelled");
  else if (scheduled) resendFlag = no("scheduled");
  else if (!policy) resendFlag = no("definition_missing");
  else if (policy.required) resendFlag = no("required");
  else if (policy.secret) resendFlag = no("secret");
  else if (targets === 0) resendFlag = no("no_failed");
  else if (policy.record === "meta") {
    resendFlag = dispatch.vars ? ok : no("no_input_copy");
    mode = dispatch.vars ? "new_dispatch" : null;
  } else {
    resendFlag = ok;
    mode = "requeue";
  }
  return { cancel, retract, resend: { ...resendFlag, mode, failed: counts.failed, unknown: counts.unknown } };
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
  /** 回の定義(読めなければ null)。テンプレートの回は固定した版 */
  definitionOf: (dispatch: MessageDispatch) => Promise<AnyResolvedMessageDefinition | null>;
  /** 組み済みの定義で新しい回を送る(record meta の再送) */
  sendResolved: (
    resolved: AnyResolvedMessageDefinition,
    input: SendMessageToManyInput,
    template?: { id: string; version: number },
  ) => Promise<SendMessageResult>;
  /** 戻した行を 1 束だけ送る(失敗しても再送は成り立つ。残りは cron) */
  continueSending: (dispatchId: string) => Promise<unknown>;
  recordAudit: (input: AuditRecordInput) => Promise<unknown>;
};

export const AdminResendInputSchema = z.object({ includeUnknown: z.boolean().optional() }).strict();

export type AdminCancelResult = { dispatchId: string; status: "cancelled" };
export type AdminRetractResult = { dispatchId: string; deletedInboxItems: number; canceledDeliveries: number; detachedImages: number };
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

/**
 * 予約の取り消し。
 * @throws DomainError(404) 回が無い / (409) 予約でない・もう送り始めた / (403) 管理者でない
 */
export async function adminCancelScheduled<Tx>(deps: AdminOperationsDeps<Tx>, dispatchId: string): Promise<AdminCancelResult> {
  await assertAdminActor(deps);
  await deps.store.withLockedDispatch(dispatchId, async (tx, dispatch) => {
    if (!dispatch) refuse("not_found");
    const flag = operationFlags(dispatch, null, { failed: 0, unknown: 0 }).cancel;
    if (!flag.allowed) refuse(flag.reason!);
    const now = deps.now();
    await deps.store.updateDispatch(tx, dispatchId, { status: "cancelled", completed_at: now, updatedAt: now });
  });
  await deps.recordAudit({ targetType: "message_dispatch", targetId: dispatchId, action: "messaging.dispatch.cancelled", metadata: {} });
  return { dispatchId, status: "cancelled" };
}

/**
 * 取り下げ。
 * @throws DomainError(404) 回が無い / (409) 取り下げ済み・取り消し済み・予約のまま / (403) 管理者でない
 */
export async function adminRetract<Tx>(deps: AdminOperationsDeps<Tx>, dispatchId: string): Promise<AdminRetractResult> {
  await assertAdminActor(deps);
  const detachedIds: string[] = [];
  const result = await deps.store.withLockedDispatch(dispatchId, async (tx, dispatch) => {
    if (!dispatch) refuse("not_found");
    const flag = operationFlags(dispatch, null, { failed: 0, unknown: 0 }).retract;
    if (!flag.allowed) refuse(flag.reason!);
    const now = deps.now();
    const deletedInboxItems = await deps.store.deleteInboxItems(tx, dispatchId);
    const canceledDeliveries = await deps.store.cancelUnsent(tx, dispatchId, now);
    detachedIds.push(...(await deps.store.detachImages(tx, dispatchId, boundInboxImageRefs(dispatch.metadata as Record<string, unknown>))));
    const metadata = metadataOf(dispatch);
    const hadImages = INBOX_IMAGES_METADATA_KEY in metadata;
    delete metadata[INBOX_IMAGES_METADATA_KEY];
    await deps.store.updateDispatch(tx, dispatchId, {
      retracted_at: now,
      // 展開を止める(取り下げの後にお知らせの行・配達を作らない)
      expand_cursor: MESSAGE_EXPAND_DONE,
      ...(hadImages ? { metadata } : {}),
      updatedAt: now,
    });
    return { dispatchId, deletedInboxItems, canceledDeliveries, detachedImages: detachedIds.length };
  });
  await deps.store.cleanupImages(detachedIds);
  await deps.recordAudit({
    targetType: "message_dispatch",
    targetId: dispatchId,
    action: "messaging.dispatch.retracted",
    metadata: { deletedInboxItems: result.deletedInboxItems, canceledDeliveries: result.canceledDeliveries, detachedImages: result.detachedImages },
  });
  return result;
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
  if (!parsed.success) throw new DomainError("再送の入力が正しくありません", { status: 400 });
  const includeUnknown = parsed.data.includeUnknown ?? false;

  const planned = await deps.store.withLockedDispatch(dispatchId, async (tx, dispatch) => {
    if (!dispatch) refuse("not_found");
    const resolved = await deps.definitionOf(dispatch);
    const counts = await deps.store.countFailed(tx, dispatchId);
    const flag = operationFlags(dispatch, policyOf(resolved, dispatch), counts, { includeUnknown }).resend;
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
      dispatch.template_id && dispatch.template_version
        ? { id: dispatch.template_id, version: dispatch.template_version }
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
