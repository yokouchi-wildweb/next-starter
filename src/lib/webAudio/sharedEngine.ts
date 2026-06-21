// src/lib/webAudio/sharedEngine.ts
//
// アプリ全体で唯一の AudioEngine(= 1 つの AudioContext)を共有するためのシングルトン。
// 効果音(playSe)・連結動画の音声(seamlessVideo)・BGM など、すべての Web Audio 機能が
// この 1 台のミキサーを使うことで、iOS Safari のオーディオセッション競合を避ける。
//
// 注意: この共有エンジンはアプリのライフタイム中ずっと生かし続ける(個別機能の unmount で
// close() しない)。AudioContext は 1 つ開きっぱなしでも軽量で、これが低レイテンシ再生の前提になる。

import { AudioEngine } from "./AudioEngine";

let shared: AudioEngine | null = null;

/** アプリ全体で共有する単一の AudioEngine を返す(無ければ生成)。 */
export function getSharedAudioEngine(): AudioEngine {
  if (!shared) shared = new AudioEngine();
  return shared;
}

/**
 * 共有 AudioContext を生成 & resume する。必ず最初の確実なユーザー操作(開始タップ等)の
 * 同期内で 1 回呼ぶこと。以降は await 後(gesture 外)の再生でも音が鳴る。冪等。
 */
export async function unlockAudio(): Promise<void> {
  await getSharedAudioEngine().unlock();
}
