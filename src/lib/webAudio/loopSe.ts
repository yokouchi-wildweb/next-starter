// src/lib/webAudio/loopSe.ts
//
// ドメイン非依存の汎用ループ効果音(ループSE)プリミティブ。
// 「処理中ハム」「高速カウントの tick」など、BGM と同時に鳴らし続ける持続的な SE を扱う。
//
// playSe(ワンショット)と同じ共有 AudioContext・共通デコードキャッシュ上で動き、
// 事前デコード済み AudioBuffer を loop 付き AudioBufferSourceNode で鳴らす。
// new Audio().loop=true と違い再生時に fetch/decode しないため、視覚アニメと同フレームで
// 低遅延に立ち上がり、desync しない。
//
// 音の経路: ループSEソース(loop) → gain → master(共有) → destination
//   - master 経由なので playSe / playBgm と同一出力(iOS のオーディオセッション競合が起きない)。
//   - BGM(1 チャンネル)とは独立。playLoopSe を呼ぶたびに独立ハンドルが生まれ、多重ループ可能。
//
// 事前デコードは汎用 preloadSe(共通 decodeCache)をそのまま使えるため専用 API は設けない。
//
// 使い方:
//   import { preloadSe, playLoopSe, unlockAudio } from "@/lib/webAudio";
//   preloadSe(["数字高速カウント.mp3"]); // 画面表示時に事前デコード
//   unlockAudio();                       // 最初のユーザー操作内で 1 回
//   const h = playLoopSe("数字高速カウント.mp3", { volume: 0.6, fadeInSec: 0.1 });
//   h.setVolume(0.3);                    // 再生中の音量変更
//   h.stop(0.2);                         // フェードアウトして停止

import { AudioEngine } from "./AudioEngine";
import { decodeAudio, resolveAudioUrl } from "./decodeCache";
import { getSharedAudioEngine } from "./sharedEngine";

/** ループSE の操作ハンドル(playLoopSe の戻り値)。 */
export type LoopSeHandle = {
  /** ループを停止する(任意でフェードアウト秒)。冪等。 */
  stop(fadeOutSec?: number): void;
  /** 再生中の音量(0.0〜)を変更する。 */
  setVolume(volume: number): void;
};

/**
 * ループ効果音を再生し、停止/音量ハンドルを返す。
 *
 * 戻り値はハンドルを「同期的に」返す(停止操作のため)。内部の取得→デコード→発音は非同期に進み、
 * デコード完了前に stop() が呼ばれても発音を開始しない(race ガード)。
 * 取得失敗・未対応環境では黙って無音にフォールバックする(playSe と同挙動。演出を止めない)。
 */
export function playLoopSe(fileName: string, opts: { volume?: number; fadeInSec?: number } = {}): LoopSeHandle {
  let baseVolume = Math.max(0, opts.volume ?? 1);
  const fadeIn = Math.max(0, opts.fadeInSec ?? 0);

  let node: AudioBufferSourceNode | null = null;
  let gain: GainNode | null = null;
  // stop() がデコード完了前に呼ばれたか(発音を開始しないためのフラグ)。
  let stopped = false;
  // 発音開始後に stop() が呼ばれた場合のフェードアウト秒(start 後にハンドルへ反映)。
  let pendingFadeOut = 0;

  const handle: LoopSeHandle = {
    stop(fadeOutSec = 0) {
      const fade = Math.max(0, fadeOutSec);
      if (stopped) return;
      stopped = true;
      if (!node || !gain) {
        // まだ発音前 → デコード完了時に開始させない
        pendingFadeOut = fade;
        return;
      }
      teardown(node, gain, fade);
      node = null;
      gain = null;
    },
    setVolume(volume: number) {
      baseVolume = Math.max(0, volume);
      if (!gain) return;
      const ctx = gain.context;
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(baseVolume, now);
    },
  };

  void start();
  return handle;

  async function start(): Promise<void> {
    if (!AudioEngine.isSupported()) return;
    try {
      const engine = getSharedAudioEngine();
      const ctx = engine.ensure();
      if (ctx.state === "suspended") await ctx.resume();

      const buf = await decodeAudio(ctx, resolveAudioUrl(fileName));

      // デコード待ちの間に stop() 済みなら発音しない
      if (stopped) return;

      const g = ctx.createGain();
      g.gain.value = fadeIn > 0 ? 0 : baseVolume;
      // 共有マスター経由(将来の全体ミュート等に追従)。無ければ destination へ直結。
      g.connect(engine.masterGain() ?? ctx.destination);

      const n = ctx.createBufferSource();
      n.buffer = buf;
      n.loop = true;
      n.connect(g);
      n.start();

      if (fadeIn > 0) {
        const now = ctx.currentTime;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(baseVolume, now + fadeIn);
      }

      node = n;
      gain = g;
    } catch {
      /* 取得失敗・未対応などは無音にフォールバック(演出を止めない) */
    }
  }
}

/** ループSE ノードを停止して破棄する(任意でフェードアウト)。bgm.teardown と同等。 */
function teardown(node: AudioBufferSourceNode, gain: GainNode, fadeOutSec: number): void {
  const ctx = gain.context;
  const now = ctx.currentTime;
  const stopAt = now + Math.max(0, fadeOutSec);
  if (fadeOutSec > 0) {
    const g = gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, stopAt);
  }
  node.onended = () => {
    try {
      node.disconnect();
      gain.disconnect();
    } catch {
      /* noop */
    }
  };
  try {
    node.stop(stopAt);
  } catch {
    /* 既に停止済みは無視 */
  }
}
