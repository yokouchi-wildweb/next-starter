// src/lib/webAudio/playSe.ts
//
// ドメイン非依存の汎用ワンショット効果音(SE)エンジン。
// 圧縮音声を一度だけ decodeAudioData で AudioBuffer に展開してキャッシュし(decodeCache 共通)、
// 再生は AudioBufferSourceNode で行う。出音はほぼ即時・サンプル精度・多重再生可能で、
// 視覚エフェクト(framer-motion / CSS)と同フレームで鳴らせる。
//
// AudioContext はアプリ共有の 1 台(getSharedAudioEngine)を使う。最初のユーザー操作内で
// unlockAudio() を 1 回呼んでおけば、以降は await 後(gesture 外)でも鳴る。
//
// 使い方:
//   preloadSe(["coin.wav", "win.wav"]) // 画面表示時などに事前デコード(初回の通信遅延を消す)
//   unlockAudio()                      // 最初のタップ等の同期内で 1 回
//   playSe("coin.wav")                 // 視覚エフェクトと同時に即時発音

import { AudioEngine } from "./AudioEngine";
import { clearDecodeCache, decodeAudio, resolveAudioUrl } from "./decodeCache";
import { getSharedAudioEngine } from "./sharedEngine";

/**
 * 効果音を 1 回再生する。後方互換シグネチャ: playSe(fileName, volume)。
 * デコード済みなら即時発音。未デコードなら取得→デコードしてから再生(初回のみ)。
 * fire-and-forget で呼べるよう、失敗してもスロー(reject)せず黙って無音にフォールバックする。
 */
export async function playSe(fileName: string, volume = 1.0): Promise<void> {
  if (!AudioEngine.isSupported()) return;
  try {
    const engine = getSharedAudioEngine();
    const ctx = engine.ensure();
    if (ctx.state === "suspended") await ctx.resume();

    const buf = await decodeAudio(ctx, resolveAudioUrl(fileName));

    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, volume);
    // 共有マスター経由(将来の全体ミュート等に追従)。無ければ destination へ直結。
    gain.connect(engine.masterGain() ?? ctx.destination);

    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.connect(gain);
    node.onended = () => {
      try {
        node.disconnect();
        gain.disconnect();
      } catch {
        /* noop */
      }
    };
    node.start();
  } catch {
    /* 取得失敗・未対応などは無音にフォールバック(演出を止めない) */
  }
}

/**
 * 画面が使う効果音を事前にデコードしてキャッシュする(初回の通信・デコード遅延を解消)。
 * 1 ファイルの失敗は他に波及させない(allSettled)。
 */
export async function preloadSe(fileNames: string[]): Promise<void> {
  if (!AudioEngine.isSupported()) return;
  let ctx: AudioContext;
  try {
    ctx = getSharedAudioEngine().ensure();
  } catch {
    return;
  }
  await Promise.allSettled(fileNames.map((name) => decodeAudio(ctx, resolveAudioUrl(name))));
}

/** デコードキャッシュを破棄する(メモリ解放)。引数省略で全件。SE/BGM 共通キャッシュ。 */
export function clearSeCache(fileNames?: string[]): void {
  clearDecodeCache(fileNames);
}
