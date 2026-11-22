// src/domains/core/messaging/services/server/admin/recipientChannels.ts
//
// 1 人の利用者が受け取れる送信チャンネルの口(D214 (2)): 送信チャンネルごとに { available, reason? }。1 人宛ての送る画面が出す情報だけ
// (選べなくするか等の見せ方は画面と fork が決める)。門の外(管理者だけ)。
// - 理由の符号 = 送る口がその配達に書く理由と同じ(ANSWERS T18 Q2): channel_off(項目が無い・enabled: false)→ no_address(宛先なし。
//   email = メールアドレスなし・line = LINE 未連携は送信チャンネルの鍵で分ける)→ preference(本人が止めた)→ suppression(宛先が全部止まっている)。
//   表示名は画面の DELIVERY_REASON_LABELS(D71)
// - 宛先の引き方と停止の判定は送る口の物をそのまま使う(resolveUserAddresses・checkStops)ので、答えが送った結果と揃う
// - 条件: message(連絡定義の鍵 → 上書きの後のカテゴリー・種別・required。required の連絡は好みで止まらない)か category(自由連絡のカテゴリー)、
//   両方は 400。どちらも無い = 受け口の全部の送信チャンネル、好みは見ず、カテゴリーに依らず当たる宛先の停止だけ(one_click は範囲 "*" だけ)

import { z } from "zod";

import { DomainError } from "@/lib/errors";
import type { MessageCategory, MessageChannel } from "@/lib/messaging";

import { userRecipientKey } from "../sendMessage/expand";
import type { StopContext, StopTarget, StopVerdict } from "../sendMessage/stops";
import { assertAdminActor, type AdminCheckDeps } from "./assertAdmin";

/** 受け取れない理由(配達の reason と同じ符号) */
export type RecipientChannelReason = "channel_off" | "no_address" | "preference" | "suppression";

export type RecipientChannelState = { available: true } | { available: false; reason: RecipientChannelReason };

/** 送信チャンネルの鍵 → 受け取れるか */
export type AdminRecipientChannels = Record<string, RecipientChannelState>;

export const RecipientChannelsQuerySchema = z
  .object({
    message: z.string().trim().min(1).max(200).optional(),
    category: z.string().trim().min(1).max(100).optional(),
  })
  .refine((query) => !(query.message && query.category), { message: "message と category は一緒に指定できません" });
export type RecipientChannelsQuery = z.input<typeof RecipientChannelsQuerySchema>;

/** 連絡定義の停止に要る値(上書きの後) */
export type RecipientChannelsDefinition = { kind: StopContext["kind"]; required?: boolean; category?: string | null; channels: readonly string[] };

export type RecipientChannelsDeps = AdminCheckDeps & {
  /** 利用者が居るか(削除済みは居ない) */
  userExists: (userId: string) => Promise<boolean>;
  categories: Readonly<Record<string, MessageCategory>>;
  /** 送信チャンネルの受け口(enabled: false の項目も入る) */
  channels: Readonly<Record<string, MessageChannel>>;
  /** 連絡定義(読めない・閉じたドメインの定義は null) */
  loadDefinition: (messageKey: string) => Promise<RecipientChannelsDefinition | null>;
  /** 利用者 → 送信チャンネルの宛先(送る口の resolveUserAddresses) */
  resolveAddresses: (channelKey: string, channel: MessageChannel, userIds: readonly string[]) => Promise<Map<string, string[]>>;
  /** 停止の判定(送る口の checkStops) */
  checkStops: (context: StopContext, targets: readonly StopTarget[]) => Promise<StopVerdict[]>;
};

/** 条件から停止の文脈と見る送信チャンネルを決める */
async function scopeOf(
  deps: RecipientChannelsDeps,
  query: z.output<typeof RecipientChannelsQuerySchema>,
): Promise<{ context: StopContext; channels: readonly string[] }> {
  if (query.message) {
    const definition = await deps.loadDefinition(query.message);
    if (!definition) throw new DomainError("連絡定義が見つかりません", { status: 404 });
    return {
      context: { kind: definition.kind, required: Boolean(definition.required), category: definition.category ?? null },
      channels: definition.channels,
    };
  }
  if (query.category) {
    const category = Object.hasOwn(deps.categories, query.category) ? deps.categories[query.category] : undefined;
    if (!category) throw new DomainError("カテゴリーが見つかりません", { status: 400 });
    return { context: { kind: category.kind, required: false, category: category.key }, channels: category.channels };
  }
  return { context: { kind: null, required: false, category: null }, channels: Object.keys(deps.channels) };
}

/**
 * 1 人の利用者の受け取れる送信チャンネル。
 * @throws DomainError(403) 管理者でない / (404) 利用者・連絡定義が無い / (400) 条件が不正・知らないカテゴリー
 */
export async function recipientChannels(
  deps: RecipientChannelsDeps,
  userId: string,
  query: RecipientChannelsQuery = {},
): Promise<AdminRecipientChannels> {
  await assertAdminActor(deps);
  const parsed = RecipientChannelsQuerySchema.safeParse(query ?? {});
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? "条件が不正です", { status: 400 });
  if (!(await deps.userExists(userId))) throw new DomainError("利用者が見つかりません", { status: 404 });
  const { context, channels } = await scopeOf(deps, parsed.data);

  const result: AdminRecipientChannels = {};
  const reachable: StopTarget[] = [];
  for (const key of channels) {
    const channel = deps.channels[key];
    if (!channel || channel.enabled === false) {
      result[key] = { available: false, reason: "channel_off" };
      continue;
    }
    const addresses = (await deps.resolveAddresses(key, channel, [userId])).get(userId) ?? [];
    if (addresses.length === 0) {
      result[key] = { available: false, reason: "no_address" };
      continue;
    }
    reachable.push({ recipientKey: userRecipientKey(userId), userId, channel: key, addresses });
  }
  const verdicts = await deps.checkStops(context, reachable);
  reachable.forEach((target, index) => {
    const verdict = verdicts[index];
    result[target.channel] = verdict?.stopped ? { available: false, reason: verdict.reason } : { available: true };
  });
  // 並びは見る送信チャンネルの順
  return Object.fromEntries(channels.map((key) => [key, result[key]!]));
}
