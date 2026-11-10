// src/features/core/messaging/services/server/sendMessage/sender.ts
//
// 新しい送る口の本体。部品(deps)を受けて sendMessage / sendMessageToMany を作る(テストは偽物の部品を渡す)。
//
// 流れ: 定義に上書きを重ねて検査 → vars の検査 → 冪等の鍵(両表)→ 回の行 →
//   小さな送信: 展開 → 配達の行 → 最初の束を経路の send へ → 行と回の数を記録
//   大きな送信・audience: 回の行だけ(status processing)。展開と送信は cron(次の指令)
// required と秘密を差し込む連絡(noBody)はキューに置けないので、要求の中で全部を送り切る(小さな選んだ宛先だけ)

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

type ManyOptions = { single?: boolean };

/** 停止の確かめに要る連絡の性質 */
export function stopContextOf(resolved: AnyResolvedMessageDefinition): StopContext {
  return { kind: resolved.kind, required: Boolean(resolved.required), category: resolved.category };
}

export function createMessageSender(deps: MessageSendDeps) {
  async function prepare(definition: AnyMessageDefinition, input: SendMessageToManyInput) {
    const resolved = await resolveDefinition(definition, deps.registry, deps.channels, deps.enrichers);
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
    },
  ): Promise<string> {
    const { channels, vars, policy, recipientCount, queueVars, expanded } = values;
    const actor = deps.actor();
    const audience = input.audience
      ? { ...input.audience }
      : recipientCount > deps.config.smallSendMaxRecipients
        ? { type: "recipients", recipients: input.recipients, recipientVars: input.recipientVars ?? null }
        : { type: "recipients", count: recipientCount };
    try {
      const { id } = await deps.store.insertDispatch({
        status: "processing",
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
    const prepared = await prepare(definition, input);
    if (!prepared) {
      return { dispatchId: null, status: "disabled", deliveries: [], queuedCount: 0, channelCounts: {} };
    }
    const { resolved, channels, vars, policy } = prepared;
    const recipients: readonly MessageRecipient[] = input.recipients ?? [];
    const uniqueCount = new Set(recipients.map(recipientKeyOf)).size;
    const large = Boolean(input.audience) || uniqueCount > deps.config.smallSendMaxRecipients;

    if (large && policy.noBody) {
      // required・秘密の連絡はキューに置けない(cron に vars を渡せない)ので、小さな選んだ宛先だけ
      throw new DomainError(
        `止められない連絡と秘密を差し込む連絡は ${deps.config.smallSendMaxRecipients} 人までの選んだ宛先にだけ送れます(${resolved.key})`,
        { status: 400 },
      );
    }

    if (large) {
      const dispatchId = await insertDispatch(resolved, input, {
        channels,
        vars,
        policy,
        recipientCount: input.audience ? 0 : uniqueCount,
        queueVars: true,
        expanded: false,
      });
      return { dispatchId, status: "processing", deliveries: [], queuedCount: 0, channelCounts: emptyChannelCounts(channels) };
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
