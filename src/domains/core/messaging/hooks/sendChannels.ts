// src/domains/core/messaging/hooks/sendChannels.ts
//
// 送る画面の送信チャンネルの初めのオン / オフの規則(純粋な関数、公開の部品、D191 D213)。
// 自由連絡の送るモーダル(カテゴリーの defaultChannels・同じ内容で送るは元の送信の送信チャンネル)と
// 定義連絡の汎用のモーダル(選択肢の initialChannels)が同じ規則で外す送信チャンネルを決める

/**
 * 初めに外す送信チャンネル = 選べる送信チャンネルのうち on に無い物。全部外れてしまう時は外さない(全部オン)
 * @param channels 選べる送信チャンネル(並びの順)
 * @param on 初めにオンにしたい送信チャンネル
 */
export function initialChannelsOff(channels: readonly string[], on: readonly string[]): string[] {
  const off = channels.filter((key) => !on.includes(key));
  return off.length === channels.length ? [] : off;
}
