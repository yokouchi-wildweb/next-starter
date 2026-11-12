// src/features/core/messaging/services/server/sendMessage/sender.ts
//
// 新しい送る口の本体。部品(deps)を受けて sendMessage / sendMessageToMany を作る(テストは偽物の部品を渡す)。
//
// 流れ: 定義に上書きを重ねて検査 → vars の検査 → 冪等の鍵(両表)→ 回の行 →
//   小さな送信: 展開 → 配達の行 → 最初の束を経路の send へ → 行と回の数を記録
//   大きな送信・audience: 回の行だけ(status processing)。展開と送信は cron(次の指令)
// required と秘密を差し込む連絡(noBody)はキューに置けないので、要求の中で全部を送り切る(小さな選んだ宛先だけ)
// 予約(scheduledAt): 回の行だけ(status scheduled、宛先の一覧は回の audience に置く)。cron の activateScheduled が時刻に processing にして展開する
// テンプレート(sendTemplate): 今の公開版から定義を組み、回に template_id + template_version を固定する(cron も同じ版から組み直す)

import { DomainError } from "@/lib/errors";

import type {
  MessageDelivery,
  MessageDeliveryInsert,
  MessageDeliveryStatus,
  MessageDispatchStatus,
} from "../../../entities/model";
import { MESSAGE_EXPAND_DONE, type MessageChannelCounts } from "../../../entities/schema";
import {
  buildRecipientValues,
  channelContent,
  checkRecipientVars,
  headingOf,
  parseVars,
  renderValue,
  toVariableMap,
} from "./context";
import {
  resolveChannels,
  resolveDefinition,
  type AnyMessageDefinition,
  type AnyResolvedMessageDefinition,
} from "./definition";
import { sendDeliveries, type DeliveryJob } from "./deliver";
import { recipientVariablesWithoutDefault, resolveTemplateDefinition, templateDefinitionOf } from "./templateDefinition";
import { expandExplicit, recipientKeyOf, type ExpansionCounts, type PlannedDelivery } from "./expand";
import { omitKeys, recordPolicyOf, type RecordPolicy } from "./record";
import { honoursPreferences, type StopContext } from "./stops";
import { MessageIdempotencyConflict } from "./errors";
import type {
  MessageDeliveryOutcome,
  MessageRecipient,
  MessageSendDeps,
  MessageUserRow,
  SendMessageInput,
  SendMessageResult,
  SendMessageToManyInput,
  SendTemplateInput,
  MessageAudienceSpec,
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
  statuses: readonly { channel: string; status: string }[],
): MessageChannelCounts {
  const counts = emptyChannelCounts(channels);
  for (const key of channels) {
    counts[key].targeted = expansion[key]?.targeted ?? 0;
    counts[key].skipped_no_address = expansion[key]?.skippedNoAddress ?? 0;
    counts[key].suppressed = expansion[key]?.suppressed ?? 0;
  }
  for (const { channel, status } of statuses) {
    if (!counts[channel]) continue;
    if (status === "sent" || status === "delivered") counts[channel].sent += 1;
    if (status === "failed" || status === "bounced") counts[channel].failed += 1;
  }
  return counts;
}

/** 回の件名・題(回の vars と受信者に依らない文脈だけで差し込む。秘密の鍵は差し込まない) */
function buildHeadings(
  deps: MessageSendDeps,
  resolved: AnyResolvedMessageDefinition,
  channels: readonly string[],
  vars: Record<string, unknown>,
  policy: RecordPolicy,
): Record<string, string> {
  const map = toVariableMap({ ...vars, ...deps.context() }, policy.secretKeys);
  const headings: Record<string, string> = {};
  for (const key of channels) {
    const heading = headingOf(channelContent(resolved, key, deps.channels[key]));
    if (heading !== null) headings[key] = renderValue(heading, map) as string;
  }
  return headings;
}

/** 全員同文の描画結果(受信者に依る鍵は {{鍵}} のまま) */
function buildRendered(
  deps: MessageSendDeps,
  resolved: AnyResolvedMessageDefinition,
  channels: readonly string[],
  vars: Record<string, unknown>,
): Record<string, unknown> {
  const map = toVariableMap({ ...vars, ...deps.context() });
  return Object.fromEntries(
    channels.map((key) => [key, renderValue(channelContent(resolved, key, deps.channels[key]), map)]),
  );
}

function finalDispatchStatus(statuses: readonly string[], queuedCount: number): MessageDispatchStatus {
  if (queuedCount > 0) return "processing";
  return statuses.some((status) => status === "failed" || status === "bounced" || status === "unknown")
    ? "completed_with_failures"
    : "completed";
}

type ManyOptions = {
  single?: boolean;
  /** 組み済みの定義(テンプレート。生成の一覧の上書きを重ねない) */
  resolved?: AnyResolvedMessageDefinition;
  /** 回に固定するテンプレートの版 */
  template?: { id: string; version: number };
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** audiences の項目に count が無い時に数える上限 */
export const ESTIMATE_CAP = 10_000;

/** 宛先数の見込み(送る時に展開で数え直す) */
export type RecipientEstimate = { count: number; capped: boolean; fixedAtSend: true };

/** 描いたプレビュー */
export type MessagePreview = {
  messageKey: string;
  kind: string;
  category: string;
  /** テンプレートなら今の公開版(送る時に固定する版) */
  template: { id: string; version: number } | null;
  channels: { key: string; label: string; fields: unknown; html?: string; text?: string }[];
};

/** 停止の確かめに要る連絡の性質 */
export function stopContextOf(resolved: AnyResolvedMessageDefinition): StopContext {
  return { kind: resolved.kind, required: Boolean(resolved.required), category: resolved.category };
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
      (await resolveDefinition(definition, deps.registry, deps.channels, deps.enrichers, deps.adminOverrides));
    if (!resolved.enabled) return null;
    const channels = resolveChannels(resolved, input.channels, deps.channels);
    const vars = parseVars(resolved, input.vars);
    for (const values of Object.values(input.recipientVars ?? {})) checkRecipientVars(resolved, values);
    const policy = recordPolicyOf(resolved);

    if (input.idempotencyKey && (await deps.store.idempotencyKeyExists(input.idempotencyKey))) {
      throw new DomainError(DUPLICATE_MESSAGE, { status: 409 });
    }
    return { resolved, channels, vars, policy };
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
      template?: { id: string; version: number };
    },
  ): Promise<string> {
    const { channels, vars, policy, recipientCount, queueVars, expanded, template } = values;
    const actor = deps.actor();
    const scheduled = input.scheduledAt !== undefined;
    // cron が展開する回(大きな送信・予約)は宛先の一覧を回に置く
    const audience = input.audience
      ? { ...input.audience }
      : scheduled || recipientCount > deps.config.smallSendMaxRecipients
        ? { type: "recipients", recipients: input.recipients, recipientVars: input.recipientVars ?? null }
        : { type: "recipients", count: recipientCount };
    try {
      const { id } = await deps.store.insertDispatch({
        status: scheduled ? "scheduled" : "processing",
        scheduled_at: input.scheduledAt ?? null,
        template_id: template?.id ?? null,
        template_version: template?.version ?? null,
        idempotency_key: input.idempotencyKey ?? null,
        channels,
        recipient_count: recipientCount,
        source: input.source ?? resolved.key,
        actor_id: actor.actorId,
        actor_type: actor.actorType,
        reason: input.reason ?? null,
        metadata: input.metadata ?? null,
        message_key: resolved.key,
        kind: resolved.kind,
        category: resolved.category,
        audience,
        tags: input.tags ? [...input.tags] : null,
        channel_counts: emptyChannelCounts(channels),
        headings: buildHeadings(deps, resolved, channels, vars, policy),
        // 回の vars: 残す時は秘密の鍵を落とした写し。cron が送る残り(queueVars)にも要る(record meta なら cron が終わりに消す)
        vars: policy.keepVars || queueVars ? omitKeys(vars, policy.secretKeys) : null,
        rendered: policy.keepRendered ? buildRendered(deps, resolved, channels, vars) : null,
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
    const recipients: readonly MessageRecipient[] = input.recipients ?? [];
    const uniqueCount = new Set(recipients.map(recipientKeyOf)).size;
    const scheduled = input.scheduledAt !== undefined;
    const large = Boolean(input.audience) || uniqueCount > deps.config.smallSendMaxRecipients;

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

    if (large || scheduled) {
      // 回の行だけ。展開は cron(予約は時刻に processing になってから)。宛先の数は展開の時に数え直す
      const dispatchId = await insertDispatch(resolved, input, {
        channels,
        vars,
        policy,
        recipientCount: input.audience ? 0 : large ? uniqueCount : 0,
        queueVars: true,
        expanded: false,
        template: options.template,
      });
      return {
        dispatchId,
        status: scheduled ? "scheduled" : "processing",
        deliveries: [],
        queuedCount: 0,
        channelCounts: emptyChannelCounts(channels),
      };
    }

    // 小さな送信: 展開してから回を書く(見つからない利用者を先に知る)
    const stops = stopContextOf(resolved);
    const expansion = await expandExplicit(deps, { channels, recipients, stops });
    if (options.single && expansion.unknownUserIds.length > 0) {
      throw new DomainError("送信先のユーザーが見つかりません", { status: 404 });
    }
    // 送った時の対象 − その時点の停止(どの経路でも止められた受信者、D31)
    const targetCount = uniqueCount - expansion.unknownUserIds.length - expansion.stoppedRecipients;
    const queueRest = !policy.noBody;
    const dispatchId = await insertDispatch(resolved, input, {
      channels,
      vars,
      policy,
      recipientCount: targetCount,
      queueVars: queueRest,
      expanded: true,
      template: options.template,
    });

    const recipientVarsOf = (key: string) => input.recipientVars?.[key];
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
    );
    const planByKey = new Map<string, PlannedDelivery>(
      expansion.planned.map((plan) => [`${plan.channel}|${plan.recipientKey}`, plan]),
    );

    // 最初の束(noBody は全部)を送る
    const queuedRows = rows.filter((row) => row.status === "queued");
    const batch = policy.noBody ? queuedRows : queuedRows.slice(0, deps.config.inRequestBatchSize);
    const jobs: DeliveryJob[] = [];
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
      const content = renderValue(
        channelContent(resolved, row.channel, deps.channels[row.channel]),
        toVariableMap(values),
      ) as Record<string, unknown>;
      bodies.set(row.id, content);
      jobs.push({
        deliveryId: row.id,
        recipientKey: row.recipient_key,
        channel: row.channel,
        userId: row.user_id,
        addresses: plan.addresses,
        attempts: row.attempts,
        content,
      });
    }

    const results = await sendDeliveries(deps, {
      messageKey: resolved.key,
      jobs,
      policy,
      inRequestOnly: policy.noBody,
      category: honoursPreferences(stops) ? resolved.category : undefined,
    });
    const statusById = new Map<string, MessageDeliveryStatus>(rows.map((row) => [row.id, row.status]));
    for (const result of results) {
      const patch = { ...result.patch };
      if (policy.keepRecipientBody) patch.body = bodies.get(result.deliveryId) ?? null;
      // 送り終えた行の受信者ごとの値は record に従う(meta なら残さない)
      if (result.status !== "queued" && !policy.keepVars) patch.vars = null;
      await deps.store.updateDelivery(result.deliveryId, patch);
      statusById.set(result.deliveryId, result.status);
    }

    const finalRows = rows.map((row) => ({ ...row, status: statusById.get(row.id) ?? row.status }));
    const queuedCount = finalRows.filter((row) => row.status === "queued").length;
    const statuses = finalRows.map((row) => row.status);
    const channelCounts = toChannelCounts(channels, expansion.counts, finalRows);
    const status = finalDispatchStatus(statuses, queuedCount);
    await deps.store.updateDispatch(dispatchId, {
      status,
      channel_counts: channelCounts,
      completed_at: status === "processing" ? null : deps.now(),
      updatedAt: deps.now(),
      // cron に渡す残りが無ければ、送るためだけに置いた vars を record に従って消す
      ...(queuedCount === 0 && !policy.keepVars ? { vars: null } : {}),
    });

    return {
      dispatchId,
      status,
      deliveries: finalRows.map((row) => toOutcome(row)),
      queuedCount,
      channelCounts,
    };
  }

  /**
   * テンプレートの今の公開版(送れる版)。
   * @throws DomainError(404) 無い / (409) 取り下げ済み・未公開 / (400) 受信者ごとの変数に既定値が無い
   */
  async function currentTemplateVersion(templateId: string): Promise<MessageTemplateVersionSource> {
    if (!deps.templates) throw new DomainError("テンプレートの読み口がありません", { status: 500 });
    const current = await deps.templates.loadCurrent(templateId);
    if (!current) throw new DomainError("テンプレートがありません", { status: 404 });
    if (current.status === "archived") throw new DomainError("取り下げたテンプレートでは送れません", { status: 409 });
    const version = current.version;
    if (!version) throw new DomainError("まだ公開していないテンプレートでは送れません", { status: 409 });
    const missing = recipientVariablesWithoutDefault(version);
    if (missing.length > 0) {
      throw new DomainError(`受信者ごとの変数 ${missing.join(", ")} に既定値が無いので送れません`, { status: 400 });
    }
    return version;
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
    /** 一括で送る(選んだ宛先か audience) */
    sendMessageToMany: (definition: AnyMessageDefinition, input: SendMessageToManyInput) =>
      sendToMany(definition, input),
    /**
     * 描いたプレビュー(管理の送信の確認)。見本の受信者 userId の値で差し込み、経路ごとに欄と(経路が描けるなら)HTML を返す。
     * テンプレートは今の公開版(送る時に固定する版と同じ規則)
     * @throws DomainError 送る時と同じ検査(vars・経路・テンプレートの状態)
     */
    async previewMessage(
      source: { definition: AnyMessageDefinition } | { templateId: string; kind?: "marketing" | "transactional" },
      input: { vars: Record<string, unknown>; channels?: readonly string[]; userId: string | null },
    ): Promise<MessagePreview> {
      let resolved: AnyResolvedMessageDefinition;
      let template: { id: string; version: number } | null = null;
      if ("definition" in source) {
        resolved = await resolveDefinition(source.definition, deps.registry, deps.channels, deps.enrichers, deps.adminOverrides);
      } else {
        const version = await currentTemplateVersion(source.templateId);
        resolved = resolveTemplateDefinition(version, source.kind ?? "marketing", deps.channels, deps.enrichers);
        template = { id: version.templateId, version: version.version };
      }
      const channels = resolveChannels(resolved, input.channels ?? (template ? resolved.defaultChannels : undefined), deps.channels);
      const vars = parseVars(resolved, input.vars);
      const [user] = input.userId ? await deps.store.findUsers([input.userId]) : [];
      const values = await buildRecipientValues({ deps, resolved, vars, recipientVars: undefined, user: user ?? null });
      const map = toVariableMap(values);
      const category = honoursPreferences(stopContextOf(resolved)) ? resolved.category : undefined;
      const items: MessagePreview["channels"] = [];
      for (const key of channels) {
        const channel = deps.channels[key];
        const fields = renderValue(channelContent(resolved, key, channel), map);
        const drawn = channel?.preview ? await channel.preview({ messageKey: resolved.key, content: fields, category }) : {};
        items.push({ key, label: channel?.label ?? key, fields, ...drawn });
      }
      return { messageKey: resolved.key, kind: resolved.kind, category: resolved.category, template, channels: items };
    },

    /**
     * 宛先数の見込み(送る時に数え直す)。全員・ロールは数、audiences は項目の count か上限まで数える、選んだ利用者は居る人の数
     */
    async estimateRecipients(
      target: { audience: MessageAudienceSpec } | { userIds: readonly string[] },
    ): Promise<RecipientEstimate> {
      if ("userIds" in target) {
        const users = await deps.store.findUsers([...new Set(target.userIds)]);
        return { count: users.length, capped: false, fixedAtSend: true };
      }
      const spec = target.audience;
      if (spec.type === "all") return { count: await deps.store.countUserIds({}), capped: false, fixedAtSend: true };
      if (spec.type === "role") {
        return { count: await deps.store.countUserIds({ roles: spec.roles }), capped: false, fixedAtSend: true };
      }
      const audience = deps.audiences[spec.key];
      if (!audience) throw new DomainError(`宛先の集め方 ${spec.key} がありません`, { status: 400 });
      const args = audience.args.safeParse(spec.args);
      if (!args.success) throw new DomainError(`宛先の集め方 ${spec.key} の引数が合いません`, { status: 400 });
      if (audience.count) return { count: await audience.count(args.data), capped: false, fixedAtSend: true };
      let total = 0;
      let cursor: string | null = null;
      do {
        const page: { userIds: string[]; nextCursor: string | null } = await audience.resolveUserIds(args.data, cursor);
        total += page.userIds.length;
        cursor = page.nextCursor;
      } while (cursor !== null && total < ESTIMATE_CAP);
      return { count: Math.min(total, ESTIMATE_CAP), capped: cursor !== null || total > ESTIMATE_CAP, fixedAtSend: true };
    },

    /**
     * 保存されたテンプレートの今の公開版で送る(版を回に固定)。
     * @throws DomainError(404) テンプレートが無い / (409) 取り下げ済み・未公開 / (400) 値・受信者ごとの変数の既定値
     */
    async sendTemplate(input: SendTemplateInput): Promise<SendMessageResult> {
      const { templateId, kind, ...rest } = input;
      const version = await currentTemplateVersion(templateId);
      const resolved = resolveTemplateDefinition(version, kind ?? "marketing", deps.channels, deps.enrichers);
      return sendToMany(templateDefinitionOf(version, kind ?? "marketing"), { ...rest, channels: rest.channels ?? version.channels } as SendMessageToManyInput, {
        resolved,
        template: { id: version.templateId, version: version.version },
      });
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
