// src/features/core/messaging/channels/line/createLineChannel.ts
//
// LINE の経路の項目を部品から作る(本物の部品は index.ts、テストは偽物を渡す)。
// - 入切: enabled(messaging の config channels.line.enabled、既定 切)。切の時は送る口が channel_off にする
// - 宛先: user_line_profiles.line_user_id(LINE の連携の機能 userLineProfile が閉じていれば宛先なし)
// - connectHref: LINE の連携の入口(好みの表が宛先の無い利用者に出す。門で閉じていれば表は出さない)
// - 送信: lib/line の push(テキスト)に X-Line-Retry-Key を付ける(鍵 = lineRetryKey(冪等の鍵)。
//   冪等の鍵 = 配達の id、宛先が複数なら <id>:<番号> → 宛先ごとに送り直しの間で変わらない鍵。LINE が受付済みなら 409 = 成功)
// - 失敗の分類: lib/line の LineApiError の retryable → transient(429・5xx・応答なし。鍵があるので応答なしも送り直して二重にならない)/
//   それ以外 → permanent。LineApiError でない例外 → unknown

import { LineApiError, lineRetryKey } from "@/lib/line";
import { lineFieldsSchema, type ChannelAddress, type ChannelSendResult, type MessageChannel } from "@/lib/messaging";

export type LineChannelDeps = {
  enabled: boolean;
  findLineUserIds: (userIds: readonly string[]) => Promise<ChannelAddress[]>;
  /** テキストを push する。options.retryKey = X-Line-Retry-Key に付ける鍵(UUID) */
  push: (to: string, text: string, options: { retryKey: string }) => Promise<unknown>;
  /** 宛先の無い利用者を案内する先(LINE の連携の入口) */
  connectHref?: string;
};

/** lib/line の誤りから失敗の分類を決める */
export function classifyLineError(error: unknown): { kind: "transient" | "permanent" | "unknown"; reason: string } {
  if (!(error instanceof LineApiError)) return { kind: "unknown", reason: "send_threw" };
  const reason = error.status === null ? "line_no_response" : `http_${error.status}`;
  return { kind: error.retryable ? "transient" : "permanent", reason };
}

export function createLineChannel(deps: LineChannelDeps): MessageChannel {
  return {
    key: "line",
    label: "LINE",
    addressing: "user",
    enabled: deps.enabled,
    fields: lineFieldsSchema,
    ...(deps.connectHref ? { connectHref: deps.connectHref } : {}),
    resolveAddresses: (userIds) => deps.findLineUserIds(userIds),
    async send(targets) {
      const results: ChannelSendResult[] = [];
      for (const target of targets) {
        const text = String((target.content as { text?: unknown }).text ?? "");
        try {
          await deps.push(target.address, text, { retryKey: lineRetryKey(target.idempotencyKey) });
          results.push({ address: target.address, kind: "sent", provider: "line", providerMessageId: null });
        } catch (error) {
          const { kind, reason } = classifyLineError(error);
          results.push({
            address: target.address,
            kind,
            reason,
            message: error instanceof Error ? error.message : String(error),
            provider: "line",
          });
        }
      }
      return results;
    },
  };
}
