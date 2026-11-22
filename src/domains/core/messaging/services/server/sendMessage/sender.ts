// src/domains/core/messaging/services/server/sendMessage/sender.ts
//
// 新しい送る口の本体。部品(deps)を受けて sendMessage / sendMessageToMany を作る(テストは偽物の部品を渡す)。
//
// 流れ: 定義に上書きを重ねて検査 → vars の検査 → 冪等の鍵(両表)→ 送信の行 →
//   小さな送信: 展開 → 配達の行 → 最初の束を送信チャンネルの send へ → 行と送信の数を記録
//   大きな送信・全員・ロール・グループ宛て: 送信の行だけ(status processing)。展開と送信は cron(次の指令)
// required と秘密を差し込む連絡(noBody)はキューに置けないので、要求の中で全部を送り切る(小さな選んだ宛先だけ)
// 予約(scheduledAt): 送信の行だけ(status scheduled、宛先の一覧は送信の target に置く)。cron の activateScheduled が時刻に processing にして展開する
// 会話の間引き(定義の throttle): 送信チャンネルの send の前に受信者ごとに当てる(throttle.ts。cron の送りも同じ)
// 自由連絡(sendFreeMessage、D117・D125・D171): レイアウトを直に選んだ物も DB のテンプレートも同じ組み方。
//   送信の message_key は null で、出どころはレイアウトだけか template_id + template_version と直した印(D128)
// 送信の記録(D128): 出どころ・直した印・カテゴリー・レイアウトの鍵と版・欄の中身(values、差し込む前)。予約・cron・失敗の再送はこの送信の物と
//   vars だけで描き直す(dispatchResolved.ts。定義・テンプレートを引き直さない)。values の残し方は vars と同じ(noBody は残さない)
// 送信チャンネル(D86): カテゴリーの送信チャンネル。input.channels はその送信だけの絞り(カテゴリーの外・空は 400)。自動の送り手は渡さない
// 口の中ですぐ送る種別(性質 sendInEntry = security、D72・D80): 予約と全員・ロール・グループ宛ては 400、宛先が多くても後回しにせず展開して最初の束を口の中で送る
// グループ宛て(D58): 送り始めに門・しまった・壊れた・人数の上限を確かめ(DomainError、送信を作らない)、定期計算は今の版を送信に固定する。
//   一員は cron が送り始めの後に 1 文で送信の受信者の一覧へ書く(sweep/expandStep.ts)

import { isLayoutAdminSelectable, isLayoutUsable, kindTraits, layoutVersionOf } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import type {
  MessageDelivery,
  MessageDeliveryInsert,
  MessageDeliveryStatus,
  MessageDispatchStatus,
} from "../../../entities/model";
import { MESSAGE_EXPAND_DONE, type MessageChannelCounts } from "../../../entities/schema";
import { buildContent, buildContents, buildRowContent } from "./content";
import { buildRecipientValues, checkRecipientVars, parseRecordVars, parseVars, toVariableMap } from "./context";
import {
  resolveChannels,
  resolveDefinition,
  type AnyMessageDefinition,
  type AnyResolvedMessageDefinition,
} from "./definition";
import { sendDeliveries, type DeliveryJob } from "./deliver";
import { deliveryEvents, dispatchCompletedEvent } from "../events/internalEvents";
import {
  resolveTemplateDefinition,
  templateValuesEdited,
  type FreeSource,
} from "./templateDefinition";
import { expandExplicit, recipientKeyOf, type ExpansionCounts, type PlannedDelivery } from "./expand";
import { omitKeys, recordPolicyOf, type RecordPolicy } from "./record";
import { honoursPreferences, type StopContext } from "./stops";
import { applyThrottle, type ThrottleJob } from "./throttle";
import { MessageIdempotencyConflict } from "./errors";
import type {
  MessageDeliveryOutcome,
  MessageRecipient,
  MessageSendDeps,
  MessageUserRow,
  SendMessageInput,
  SendMessageResult,
  SendMessageToManyInput,
  MessageDispatchTemplateSource,
  MessageFreeOrigin,
  SendFreeMessageInput,
  MessageTargetSpec,
  MessageTemplateVersionSource,
} from "./types";

const DUPLICATE_MESSAGE =
  "この送信操作は既に実行されています（二重送信防止）。送信状況は送信記録を確認してください。";

function emptyChannelCounts(channels: readonly string[]): MessageChannelCounts {
  return Object.fromEntries(
    channels.map((key) => [
      key,
      { targeted: 0, sent: 0, failed: 0, skipped_no_address: 0, skipped_throttled: 0, suppressed: 0 },
    ]),
  );
}

function toChannelCounts(
  channels: readonly string[],
  expansion: ExpansionCounts,
  statuses: readonly { channel: string; status: string; reason?: string | null }[],
): MessageChannelCounts {
  const counts = emptyChannelCounts(channels);
  for (const key of channels) {
    counts[key].targeted = expansion[key]?.targeted ?? 0;
    counts[key].skipped_no_address = expansion[key]?.skippedNoAddress ?? 0;
    counts[key].suppressed = expansion[key]?.suppressed ?? 0;
  }
  for (const { channel, status, reason } of statuses) {
    if (!counts[channel]) continue;
    if (status === "sent" || status === "delivered") counts[channel].sent += 1;
    if (status === "failed" || status === "bounced") counts[channel].failed += 1;
    // 間引いた行(お知らせの置き換えは sent に数える)
    if (status === "suppressed" && reason === "throttled") counts[channel].skipped_throttled += 1;
  }
  return counts;
}

/**
 * 送信の件名・題(送信チャンネルごとの要約の題。送信の vars と受信者に依らない文脈だけで差し込む。秘密の鍵は差し込まない = 見出しに秘密が入らない)。
 * 組み立てを通るので、描けない送信チャンネルはここで止まる(送信を書く前)
 */
async function buildHeadings(
  deps: MessageSendDeps,
  resolved: AnyResolvedMessageDefinition,
  channels: readonly string[],
  vars: Record<string, unknown>,
  policy: RecordPolicy,
): Promise<Record<string, string>> {
  const built = await buildContents(deps, resolved, channels, toVariableMap({ ...vars, ...deps.context() }, policy.secretKeys));
  return Object.fromEntries(Object.entries(built).map(([key, { heading }]) => [key, heading]));
}

/** 全員同文の描画結果(送信チャンネルごとの中身。受信者に依る鍵は {{鍵}} のまま) */
async function buildRendered(
  deps: MessageSendDeps,
  resolved: AnyResolvedMessageDefinition,
  channels: readonly string[],
  vars: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const built = await buildContents(deps, resolved, channels, toVariableMap({ ...vars, ...deps.context() }));
  return Object.fromEntries(Object.entries(built).map(([key, { content }]) => [key, content]));
}

function finalDispatchStatus(statuses: readonly string[], queuedCount: number): MessageDispatchStatus {
  if (queuedCount > 0) return "processing";
  return statuses.some((status) => status === "failed" || status === "bounced" || status === "unknown")
    ? "completed_with_failures"
    : "completed";
}

type ManyOptions = {
  single?: boolean;
  /** 組み済みの定義(テンプレート + 中身。生成の一覧の上書きを重ねない) */
  resolved?: AnyResolvedMessageDefinition;
  /** 送信に残すテンプレートの出どころ(ある送信は message_key が null) */
  source?: MessageDispatchTemplateSource;
} & MessageDefinitionSendOptions;

/** 管理の定義の送信だけが渡す物(コードの送信は渡さない) */
export type MessageDefinitionSendOptions = {
  /**
   * 受信者ごとに記録から埋める vars の鍵(定義の recordVars、D195)。送信の vars はこの鍵を除いて、受信者ごとの値はこの鍵を定義の zod で検査する
   */
  recordVarKeys?: readonly string[];
  /** 管理者がテキストを編集した欄(送信の edited_fields、D202。空・省略 = 編集なし) */
  editedFields?: readonly string[] | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** 宛先数の見込み(送る時に展開で数え直す) */
export type RecipientEstimate = {
  count: number;
  fixedAtSend: true;
  /** グループ宛てだけ: 人数の上限と、超えているか(超えたグループには送れない) */
  memberLimit?: number;
  overLimit?: boolean;
};

const GROUPS_CLOSED = "ユーザーグループの機能が閉じています(グループ宛てには送れません)";

/** グループ宛ての送り始めの確かめ(門・しまった・壊れた・版・人数の上限)。定期計算は固定する版を返す */
async function checkGroupTarget(deps: MessageSendDeps, groupId: string): Promise<{ version: number | null }> {
  if (!deps.groups || !deps.groups.enabled()) throw new DomainError(GROUPS_CLOSED, { status: 404 });
  const target = await deps.groups.sendTarget(groupId);
  if (target.overLimit) {
    throw new DomainError(`グループの人数 ${target.count} が上限 ${target.memberLimit} を超えています`, { status: 409 });
  }
  return { version: target.version };
}

/** 描いたプレビュー */
export type MessagePreview = {
  messageKey: string;
  kind: string;
  /** カテゴリー(取引の連絡は無い = null) */
  category: string | null;
  /** テンプレートなら今の公開版(送る時に固定する版) */
  template: { id: string; version: number } | null;
  channels: { key: string; label: string; fields: unknown; html?: string; text?: string }[];
};

/** 停止の確かめに要る連絡の性質 */
export function stopContextOf(resolved: AnyResolvedMessageDefinition): StopContext {
  return { kind: resolved.kind, required: Boolean(resolved.required), category: resolved.category ?? null };
}

export function createMessageSender(deps: MessageSendDeps) {
  /** @throws DomainError(400) 過ぎた時刻・遠すぎる時刻 */
  function checkSchedule(scheduledAt: Date | undefined): void {
    if (scheduledAt === undefined) return;
    const now = deps.now().getTime();
    const at = scheduledAt instanceof Date ? scheduledAt.getTime() : Number.NaN;
    if (Number.isNaN(at)) throw new DomainError("予約の時刻が正しくありません", { status: 400 });
    if (at <= now) throw new DomainError("予約の時刻が過ぎています", { status: 400 });
    const maxDays = deps.config.schedule.maxDaysAhead;
    if (at > now + maxDays * DAY_MS) {
      throw new DomainError(`予約は ${maxDays} 日先までです`, { status: 400 });
    }
  }

  async function prepare(definition: AnyMessageDefinition, input: SendMessageToManyInput, options: ManyOptions = {}) {
    checkSchedule(input.scheduledAt);
    const resolved =
      options.resolved ??
      (await resolveDefinition(definition, deps));
    if (!resolved.enabled) return null;
    // 連絡のドメインが門で閉じていれば送らない(送信も配達も作らない、呼び手の業務は止めない。D77)
    if (deps.domainOpen && !deps.domainOpen(resolved.key)) {
      console.warn(`[messaging] 連絡 ${resolved.key} はドメインが閉じているので送りません(disabled)`);
      return null;
    }
    const channels = resolveChannels(resolved, input.channels);
    const recordVarKeys = options.recordVarKeys ?? [];
    const vars = parseVars(resolved, input.vars, recordVarKeys);
    // 受信者ごとの値: 記録から埋める鍵は定義の zod で検査した値に置き換える(ほかの鍵は上書きできない鍵の検査だけ)
    let recipientVars = input.recipientVars;
    if (recordVarKeys.length > 0) {
      // 名指しの受信者は全員を検査する(記録の値が無い受信者も必須の欠けで 400。D195)
      const given = input.recipientVars ?? {};
      const keys = new Set([...Object.keys(given), ...(input.recipients ?? []).map(recipientKeyOf)]);
      recipientVars = Object.fromEntries([...keys].map((key) => [key, parseRecordVars(resolved, given[key] ?? {}, recordVarKeys)]));
    } else {
      for (const values of Object.values(input.recipientVars ?? {})) checkRecipientVars(resolved, values);
    }
    const policy = recordPolicyOf(resolved);

    if (input.idempotencyKey && (await deps.store.idempotencyKeyExists(input.idempotencyKey))) {
      throw new DomainError(DUPLICATE_MESSAGE, { status: 409 });
    }
    return { resolved, channels, vars, recipientVars, policy };
  }

  async function insertDispatch(
    resolved: AnyResolvedMessageDefinition,
    input: SendMessageToManyInput,
    values: {
      channels: string[];
      vars: Record<string, unknown>;
      policy: RecordPolicy;
      recipientCount: number;
      queueVars: boolean;
      /** 要求の中で展開を終える(小さな送信) */
      expanded: boolean;
      source?: MessageDispatchTemplateSource;
      /** グループ宛ての送り始めに固定した定期計算の版(静的・動的は null) */
      groupVersion?: number | null;
      /** 管理者がテキストを編集した欄(定義連絡の送信だけ) */
      editedFields?: readonly string[] | null;
    },
  ): Promise<string> {
    const { channels, vars, policy, recipientCount, queueVars, expanded, source } = values;
    const editedFields = !source && values.editedFields && values.editedFields.length > 0 ? [...values.editedFields] : null;
    const template = source && "template" in source ? source.template : null;
    const deletedTemplate = source && "deletedTemplate" in source ? source.deletedTemplate : null;
    const actor = deps.actor();
    const scheduled = input.scheduledAt !== undefined;
    // 見出しと全員同文の描画は送信を書く前に組む(描けない送信チャンネルはここで止まり、送信を作らない)
    const headings = await buildHeadings(deps, resolved, channels, vars, policy);
    const rendered = policy.keepRendered ? await buildRendered(deps, resolved, channels, vars) : null;
    // cron が展開する送信(大きな送信・予約)は宛先の一覧を送信に置く
    const target = input.target
      ? input.target.type === "group"
        ? { ...input.target, version: values.groupVersion ?? null }
        : { ...input.target }
      : scheduled || recipientCount > deps.config.smallSendMaxRecipients
        ? { type: "recipients", recipients: input.recipients, recipientVars: input.recipientVars ?? null }
        : { type: "recipients", count: recipientCount };
    try {
      const { id } = await deps.store.insertDispatch({
        status: scheduled ? "scheduled" : "processing",
        scheduled_at: input.scheduledAt ?? null,
        template_id: template?.id ?? null,
        template_version: template?.version ?? deletedTemplate?.version ?? null,
        template_edited: template?.edited ?? deletedTemplate?.edited ?? false,
        edited_fields: editedFields,
        layout: resolved.layout,
        layout_version: deps.layouts[resolved.layout] ? layoutVersionOf(deps.layouts[resolved.layout]!) : null,
        // 欄の中身: 組み直しに要る間と残す段の間だけ(vars と同じ決まり)。required・秘密の連絡は残さない
        values: !policy.noBody && (policy.keepVars || queueVars) ? { ...resolved.values } : null,
        idempotency_key: input.idempotencyKey ?? null,
        channels,
        recipient_count: recipientCount,
        source: input.source ?? resolved.key,
        actor_id: actor.actorId,
        actor_type: actor.actorType,
        reason: input.reason ?? null,
        metadata: input.metadata ?? null,
        // 自由連絡の送信は定義連絡の鍵を持たない(出どころはレイアウトだけか template_id、D128)
        message_key: source ? null : resolved.key,
        kind: resolved.kind,
        category: resolved.category,
        target,
        tags: input.tags ? [...input.tags] : null,
        channel_counts: emptyChannelCounts(channels),
        headings,
        // 送信の vars(出どころに依らず 1 つ、D202。DB のテンプレートの専用の値もここ): 残す時は秘密の鍵を落とした写し。
        // cron が送る残り(queueVars)にも要る(record meta なら cron が終わりに消す)
        vars: policy.keepVars || queueVars ? omitKeys(vars, policy.secretKeys) : null,
        rendered,
        record: policy.record,
        show_to_later_signups: input.showToLaterSignups ?? false,
        is_test: input.isTest ?? false,
        expand_cursor: expanded ? MESSAGE_EXPAND_DONE : null,
      });
      return id;
    } catch (error) {
      if (error instanceof MessageIdempotencyConflict) throw new DomainError(DUPLICATE_MESSAGE, { status: 409 });
      throw error;
    }
  }

  async function sendToMany(
    definition: AnyMessageDefinition,
    input: SendMessageToManyInput,
    options: ManyOptions = {},
  ): Promise<SendMessageResult> {
    const prepared = await prepare(definition, input, options);
    if (!prepared) {
      return { dispatchId: null, status: "disabled", deliveries: [], queuedCount: 0, channelCounts: {} };
    }
    const { resolved, channels, vars, policy } = prepared;
    // 受信者ごとの値は検査した物(記録から埋める値は zod を通した値)で送る
    input = { ...input, recipientVars: prepared.recipientVars } as SendMessageToManyInput;
    /** 送信と事件に残す連絡の鍵(テンプレートからの送信は null) */
    const recordKey = options.source ? null : resolved.key;
    const recipients: readonly MessageRecipient[] = input.recipients ?? [];
    const uniqueCount = new Set(recipients.map(recipientKeyOf)).size;
    const scheduled = input.scheduledAt !== undefined;
    const inEntry = Boolean(kindTraits(resolved.kind)?.sendInEntry);
    if (inEntry && (scheduled || input.target)) {
      throw new DomainError(`種別 ${resolved.kind} の連絡は予約・宛先の集め方では送れません(選んだ宛先に今すぐ送る、${resolved.key})`, {
        status: 400,
      });
    }
    // 口の中ですぐ送る種別は宛先が多くても展開して最初の束を口の中で送る(残りは cron)
    const large = !inEntry && (Boolean(input.target) || uniqueCount > deps.config.smallSendMaxRecipients);

    if (scheduled && policy.noBody) {
      throw new DomainError(`止められない連絡と秘密を差し込む連絡は予約できません(${resolved.key})`, { status: 400 });
    }
    if (large && policy.noBody) {
      // required・秘密の連絡はキューに置けない(cron に vars を渡せない)ので、小さな選んだ宛先だけ
      throw new DomainError(
        `止められない連絡と秘密を差し込む連絡は ${deps.config.smallSendMaxRecipients} 人までの選んだ宛先にだけ送れます(${resolved.key})`,
        { status: 400 },
      );
    }

    const group = input.target?.type === "group" ? await checkGroupTarget(deps, input.target.groupId) : null;

    if (large || scheduled) {
      // 送信の行だけ。展開は cron(予約は時刻に processing になってから)。宛先の数は展開の時に数え直す
      const dispatchId = await insertDispatch(resolved, input, {
        channels,
        vars,
        policy,
        recipientCount: input.target ? 0 : large ? uniqueCount : 0,
        queueVars: true,
        expanded: false,
        source: options.source,
        editedFields: options.editedFields,
        groupVersion: group?.version ?? null,
      });
      return {
        dispatchId,
        status: scheduled ? "scheduled" : "processing",
        deliveries: [],
        queuedCount: 0,
        channelCounts: emptyChannelCounts(channels),
      };
    }

    // 小さな送信: 展開してから送信を書く(見つからない利用者を先に知る)
    const stops = stopContextOf(resolved);
    const expansion = await expandExplicit(deps, { channels, recipients, stops });
    if (options.single && expansion.unknownUserIds.length > 0) {
      throw new DomainError("送信先のユーザーが見つかりません", { status: 404 });
    }
    // 送った時の対象 − その時点の停止(どの送信チャンネルでも止められた受信者、D31)
    const targetCount = uniqueCount - expansion.unknownUserIds.length - expansion.stoppedRecipients;
    const queueRest = !policy.noBody;
    const dispatchId = await insertDispatch(resolved, input, {
      channels,
      vars,
      policy,
      recipientCount: targetCount,
      queueVars: queueRest,
      expanded: true,
      source: options.source,
      editedFields: options.editedFields,
    });

    const recipientVarsOf = (key: string) => input.recipientVars?.[key];
    // 内部の事件(購読が聞いている種類だけ、行の書き込みと同じ取引で)
    const types = deps.eventTypes ?? new Set<string>();
    const rows = await deps.store.insertDeliveries(
      expansion.planned.map((plan): MessageDeliveryInsert => {
        const recipientVars = recipientVarsOf(plan.recipientKey);
        return {
          dispatch_id: dispatchId,
          recipient_key: plan.recipientKey,
          user_id: plan.userId,
          address: plan.addresses[0] ?? null,
          channel: plan.channel,
          status: plan.status,
          reason: plan.reason,
          // 受信者ごとの値: 残す時と cron が送る残りに要る時(秘密の印は定義の vars にだけあるので落とす鍵は同じ)
          vars:
            recipientVars && (policy.keepVars || queueRest) && plan.status === "queued"
              ? omitKeys(recipientVars, policy.secretKeys)
              : null,
          next_attempt_at: plan.status === "queued" && queueRest ? deps.now() : null,
          targets:
            plan.addresses.length > 1
              ? plan.addresses.map((address) => ({
                  address,
                  status: "queued" as const,
                  attempts: 0,
                  next_attempt_at: null,
                  provider_message_id: null,
                  last_error: null,
                }))
              : null,
        };
      }),
      // 止めた行(宛先なし・送信チャンネルが切・好み・宛先の停止)は delivery.suppressed
      types.size > 0 ? (created) => deliveryEvents(types, created, recordKey, deps.now()) : undefined,
    );
    const planByKey = new Map<string, PlannedDelivery>(
      expansion.planned.map((plan) => [`${plan.channel}|${plan.recipientKey}`, plan]),
    );

    // 最初の束(noBody は全部)を送る
    const queuedRows = rows.filter((row) => row.status === "queued");
    const batch = policy.noBody ? queuedRows : queuedRows.slice(0, deps.config.inRequestBatchSize);
    const throttleJobs: ThrottleJob[] = [];
    const bodies = new Map<string, Record<string, unknown>>();
    for (const row of batch) {
      const plan = planByKey.get(`${row.channel}|${row.recipient_key}`)!;
      const user: MessageUserRow | null = row.user_id ? (expansion.users.get(row.user_id) ?? null) : null;
      const values = await buildRecipientValues({
        deps,
        resolved,
        vars,
        recipientVars: recipientVarsOf(row.recipient_key),
        user,
      });
      const { content } = await buildRowContent(deps, resolved, row.channel, values, policy);
      bodies.set(row.id, content);
      throttleJobs.push({
        values,
        job: {
          deliveryId: row.id,
          recipientKey: row.recipient_key,
          dispatchId,
          channel: row.channel,
          userId: row.user_id,
          addresses: plan.addresses,
          attempts: row.attempts,
          content,
        },
      });
    }

    // 会話の間引き(throttle のある連絡だけ。決めた行は間引きが書いたので、ここでは状態だけ写す)
    const throttled = await applyThrottle(deps, {
      dispatchId,
      targetType: input.target?.type ?? null,
      resolved,
      vars,
      policy,
      jobs: throttleJobs,
    });
    const jobs: DeliveryJob[] = throttled.jobs;
    const statusById = new Map<string, MessageDeliveryStatus>(rows.map((row) => [row.id, row.status]));
    const reasonById = new Map<string, string | null>(rows.map((row) => [row.id, row.reason ?? null]));
    for (const decided of throttled.decided) {
      statusById.set(decided.deliveryId, decided.status);
      reasonById.set(decided.deliveryId, decided.reason);
    }

    const results = await sendDeliveries(deps, {
      messageKey: resolved.key,
      jobs,
      policy,
      inRequestOnly: policy.noBody,
      category: honoursPreferences(stops) ? resolved.category : undefined,
    });
    for (const result of results) {
      const patch = { ...result.patch };
      if (policy.keepRecipientBody) patch.body = bodies.get(result.deliveryId) ?? null;
      // 送り終えた行の受信者ごとの値は record に従う(meta なら残さない)
      if (result.status !== "queued" && !policy.keepVars) patch.vars = null;
      const row = rows.find((item) => item.id === result.deliveryId)!;
      await deps.store.updateDelivery(
        result.deliveryId,
        patch,
        deliveryEvents(types, [{ ...row, status: result.status }], recordKey, deps.now()),
      );
      statusById.set(result.deliveryId, result.status);
    }

    const finalRows = rows.map((row) => ({
      ...row,
      status: statusById.get(row.id) ?? row.status,
      reason: (reasonById.get(row.id) ?? null) as MessageDelivery["reason"],
    }));
    const queuedCount = finalRows.filter((row) => row.status === "queued").length;
    const statuses = finalRows.map((row) => row.status);
    const channelCounts = toChannelCounts(channels, expansion.counts, finalRows);
    const status = finalDispatchStatus(statuses, queuedCount);
    // 要求の中で閉じた送信は dispatch.completed(processing のままなら cron が閉じる時に書く)
    const completed =
      status === "processing"
        ? null
        : dispatchCompletedEvent(types, { id: dispatchId, message_key: recordKey }, status, deps.now(), {
            isTest: input.isTest ?? false,
          });
    await deps.store.updateDispatch(
      dispatchId,
      {
        status,
        channel_counts: channelCounts,
        completed_at: status === "processing" ? null : deps.now(),
        updatedAt: deps.now(),
        // cron に渡す残りが無ければ、送るためだけに置いた vars を record に従って消す
        ...(queuedCount === 0 && !policy.keepVars ? { vars: null, values: null } : {}),
      },
      completed ? [completed] : [],
    );

    return {
      dispatchId,
      status,
      deliveries: finalRows.map((row) => toOutcome(row)),
      queuedCount,
      channelCounts,
    };
  }

  /**
   * テンプレートの今の版(送れる版)。
   * @throws DomainError(404) 無い / (409) 版が無い・今の版でない版
   */
  async function currentTemplateVersion(templateId: string, pinned?: number): Promise<MessageTemplateVersionSource> {
    if (!deps.templates) throw new DomainError("テンプレートの読み口がありません", { status: 500 });
    const current = await deps.templates.loadCurrent(templateId);
    if (!current) throw new DomainError("テンプレートがありません", { status: 404 });
    const version = current.version;
    if (!version) throw new DomainError("まだ公開していないテンプレートでは送れません", { status: 409 });
    if (pinned !== undefined && pinned !== version.version) {
      throw new DomainError(`テンプレートの版 ${pinned} は今の公開版(版 ${version.version})ではありません。読み直してください`, { status: 409 });
    }
    return version;
  }

  /**
   * 出どころ → 組み済みの出どころ(管理画面で選べるレイアウトか、DB のテンプレートの今の公開版)。
   * @throws DomainError(400) 無いレイアウト・管理画面で選べないレイアウト(定義連絡の物・無効の物)・無効のレイアウトのテンプレート / (404・409・400) DB のテンプレートの状態(currentTemplateVersion)
   */
  async function freeSourceOf(origin: MessageFreeOrigin): Promise<FreeSource> {
    if ("layout" in origin) {
      const layout = deps.layouts[origin.layout];
      if (!layout || !isLayoutAdminSelectable(layout)) {
        throw new DomainError(`レイアウト ${origin.layout} は自由連絡で選べません(管理画面で選べるレイアウトだけ)`, { status: 400 });
      }
      return { layout };
    }
    const version = await currentTemplateVersion(origin.id, origin.version);
    // 無効のレイアウト(fork の layout.override.ts の disabled)のテンプレートは送らない(一覧は使えない印付きで並ぶ)
    const layout = deps.layouts[version.layout];
    if (layout && !isLayoutUsable(layout)) {
      throw new DomainError(`レイアウト ${version.layout} は使えません(無効)。テンプレート ${version.templateKey} は送れません`, { status: 400 });
    }
    return { version };
  }

  return {
    /** 1 通(1 人)を送る */
    async sendMessage(definition: AnyMessageDefinition, input: SendMessageInput): Promise<SendMessageResult> {
      const { recipient, recipientVars, ...rest } = input;
      return sendToMany(
        definition,
        {
          ...rest,
          recipients: [recipient],
          recipientVars: recipientVars ? { [recipientKeyOf(recipient)]: recipientVars } : undefined,
        },
        { single: true },
      );
    },
    /** 一括で送る(選んだ宛先か宛先の指定 target) */
    sendMessageToMany: (definition: AnyMessageDefinition, input: SendMessageToManyInput) =>
      sendToMany(definition, input),
    /**
     * 組み済みの定義で送る(管理の再送が新しい送信として送る時: 送信から組んだ定義で、上書きを重ね直さない。テンプレートの送信は同じ出どころを残す。
     * 管理の定義の送信: テキストの編集を重ねた定義で、記録から埋める vars の鍵と編集した欄を渡す)
     */
    sendResolved: (
      resolved: AnyResolvedMessageDefinition,
      input: SendMessageToManyInput,
      source?: MessageDispatchTemplateSource,
      options: MessageDefinitionSendOptions = {},
    ) => sendToMany(resolved as AnyMessageDefinition, input, { resolved, source, ...options }),

    /**
     * 描いたプレビュー(管理の送信の確認)。見本の受信者 userId の値で差し込み、送信チャンネルごとに欄と(送信チャンネルが描けるなら)HTML を返す。
     * 自由連絡の中身は送る時と同じ組み方(DB のテンプレートは今の公開版の変数の宣言)
     * @throws DomainError 送る時と同じ検査(vars・送信チャンネル・欄・テンプレートの状態)
     */
    async previewMessage(
      source:
        | { definition: AnyMessageDefinition }
        | { resolved: AnyResolvedMessageDefinition }
        | { free: { origin: MessageFreeOrigin; values: Record<string, unknown>; category: string } },
      input: {
        vars: Record<string, unknown>;
        channels?: readonly string[];
        userId: string | null;
        /** 見本の受信者の値(管理の定義の送信の記録の入口: 最初の記録から埋める値) */
        recipientVars?: Record<string, unknown>;
        /** 記録から埋める vars の鍵(recipientVars のうち定義の zod で検査する鍵) */
        recordVarKeys?: readonly string[];
      },
    ): Promise<MessagePreview> {
      let resolved: AnyResolvedMessageDefinition;
      let template: { id: string; version: number } | null = null;
      if ("definition" in source) {
        resolved = await resolveDefinition(source.definition, deps);
      } else if ("resolved" in source) {
        resolved = source.resolved;
      } else {
        const { values, category, origin } = source.free;
        const from = await freeSourceOf(origin);
        resolved = resolveTemplateDefinition(deps, { category, values, channels: input.channels, source: from });
        if ("version" in from) template = { id: from.version.templateId, version: from.version.version };
      }
      // 送信チャンネル = カテゴリーの送信チャンネル、input.channels はその中の絞り
      const channels = resolveChannels(resolved, input.channels);
      const recordVarKeys = input.recordVarKeys ?? [];
      const vars = parseVars(resolved, input.vars, recordVarKeys);
      let recipientVars = input.recipientVars;
      if (recordVarKeys.length > 0) recipientVars = parseRecordVars(resolved, input.recipientVars ?? {}, recordVarKeys);
      else if (recipientVars) checkRecipientVars(resolved, recipientVars);
      const [user] = input.userId ? await deps.store.findUsers([input.userId]) : [];
      const values = await buildRecipientValues({ deps, resolved, vars, recipientVars, user: user ?? null });
      const map = toVariableMap(values);
      const category = honoursPreferences(stopContextOf(resolved)) ? resolved.category : undefined;
      const items: MessagePreview["channels"] = [];
      for (const key of channels) {
        const channel = deps.channels[key];
        // 送る時と同じ組み立て(fields = 送信チャンネルへ渡す中身)
        const { content: fields } = await buildContent(deps, resolved, key, map);
        const drawn = channel?.preview ? await channel.preview({ messageKey: resolved.key, content: fields, category }) : {};
        items.push({ key, label: channel?.label ?? key, fields, ...drawn });
      }
      return { messageKey: resolved.key, kind: resolved.kind, category: resolved.category ?? null, template, channels: items };
    },

    /**
     * 宛先数の見込み(送る時に数え直す)。全員・ロールは数、選んだ利用者は居る人の数、
     * グループは一員の数と上限(超えても投げない。送る口が 409 で拒む)
     * @throws DomainError(404) グループ: 門が閉・無い / (409) しまった・壊れた・版が無い / (503) 時間の上限
     */
    async estimateRecipients(
      input: { target: MessageTargetSpec } | { userIds: readonly string[] },
    ): Promise<RecipientEstimate> {
      if ("userIds" in input) {
        const users = await deps.store.findUsers([...new Set(input.userIds)]);
        return { count: users.length, fixedAtSend: true };
      }
      const spec = input.target;
      if (spec.type === "group") {
        if (!deps.groups || !deps.groups.enabled()) throw new DomainError(GROUPS_CLOSED, { status: 404 });
        const counted = await deps.groups.sendTarget(spec.groupId);
        return { count: counted.count, fixedAtSend: true, memberLimit: counted.memberLimit, overLimit: counted.overLimit };
      }
      if (spec.type === "all") return { count: await deps.store.countUserIds({}), fixedAtSend: true };
      return { count: await deps.store.countUserIds({ roles: spec.roles }), fixedAtSend: true };
    },

    /**
     * 自由連絡を送る(D117・D125・D171)。レイアウトを直に選んだ物も DB のテンプレートも同じ組み方。
     * 送信チャンネル = カテゴリーの送信チャンネル ∩ 絞り。送信に欄の中身を残し、DB のテンプレートは今の公開版を固定して直した印(入力の edited か中身の違い)を残す
     * (cron は送信の欄の中身で組み直す)
     * @throws DomainError(404) テンプレートが無い / (409) 版が無い・今の版でない版 / (400) レイアウト・カテゴリー・値・送信チャンネル・中身・受信者ごとの変数の既定値
     */
    async sendFreeMessage(input: SendFreeMessageInput): Promise<SendMessageResult> {
      const { origin, values, edited, category, vars, ...rest } = input;
      // 埋め込み情報の値は DB のテンプレートの版の宣言の zod で検査する。宣言の無いレイアウトに値を渡すと 400(知らない鍵)
      const from = await freeSourceOf(origin);
      const resolved = resolveTemplateDefinition(deps, { category, values, channels: rest.channels, source: from });
      const source: MessageDispatchTemplateSource =
        "layout" in from
          ? { layout: from.layout.key }
          : {
              template: {
                id: from.version.templateId,
                version: from.version.version,
                edited: edited === true || templateValuesEdited(deps.layouts, from.version, values),
              },
            };
      const result = await sendToMany(
        resolved as AnyMessageDefinition,
        // 専用の値は定義の vars(版の宣言の zod)で検査して差し込み、送信の vars に残す
        { ...rest, vars: vars ?? {} } as SendMessageToManyInput,
        { resolved, source },
      );
      return "template" in source ? { ...result, template: source.template } : result;
    },
  };
}

function toOutcome(row: MessageDelivery): MessageDeliveryOutcome {
  return {
    deliveryId: row.id,
    recipientKey: row.recipient_key,
    userId: row.user_id,
    channel: row.channel,
    status: row.status,
    reason: row.reason ?? null,
  };
}

export type MessageSender = ReturnType<typeof createMessageSender>;
