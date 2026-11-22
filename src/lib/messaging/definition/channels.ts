// src/lib/messaging/definition/channels.ts
//
// 連絡定義の送信チャンネルの固定(D212・D213)を、カテゴリーの送信チャンネルに当てて分ける純粋な関数。
// 送る口(resolveChannels)と管理者が送る画面(既定のオン = カテゴリーの defaultChannels のうち自由な物)が同じ分け方を読む。

import type { MessageChannelMode, ResolvedMessageDefinition } from "./types";

/** 送信チャンネル 1 つの固定(書いていない = free) */
export function channelModeOf(resolved: Pick<ResolvedMessageDefinition, "channelModes">, channel: string): MessageChannelMode {
  return resolved.channelModes?.[channel] ?? "free";
}

/** カテゴリーの送信チャンネルを固定で分ける(並びはカテゴリーの順) */
export function definitionChannels(resolved: Pick<ResolvedMessageDefinition, "channels" | "channelModes">): {
  on: string[];
  free: string[];
  off: string[];
} {
  const out = { on: [] as string[], free: [] as string[], off: [] as string[] };
  for (const channel of resolved.channels) out[channelModeOf(resolved, channel)].push(channel);
  return out;
}
