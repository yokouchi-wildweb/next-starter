// src/lib/webAudio/bgm.ts
//
// ドメイン非依存の汎用 BGM コントローラ。
// SE(playSe)と同じ共有 AudioContext(getSharedAudioEngine)・共通デコードキャッシュ上で動く。
// 事前デコード済み AudioBuffer を AudioBufferSourceNode(loop) で鳴らすため、
// 開始タップ=アニメ開始と同時に低遅延で立ち上がる(初回・未キャッシュ時のみ取得→デコード)。
//
// 音の経路: BGMソース(loop) → bgmGain → master(共有) → destination
//   - 実効音量 = baseVolume(setBgmVolume) × duckRatio(duckBgm)。両者を掛けて bgmGain に反映。
//   - master 経由なので SE と同一出力(iOS のオーディオセッション競合が起きない)。
//
// HTMLAudioElement を使わない(resume 済み共有 ctx 上の BufferSource)ため、ブラウザ起因の
// 勝手な pause が構造的に発生しない。consumer 側の iOS 自動復帰ハックは不要。
//
// BGM は基本 1 チャンネル(同時 1 曲)。crossfade 時のみ一時的に 2 ソースが重なる。

import { AudioEngine } from "./AudioEngine";
import { decodeAudio, resolveAudioUrl } from "./decodeCache";
import { getSharedAudioEngine } from "./sharedEngine";

class BgmController {
  private node: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private currentUrl: string | null = null;
  private baseVolume = 1;
  private duckRatio = 1;
  private loop = true;

  private effective(): number {
    return Math.max(0, this.baseVolume) * Math.max(0, this.duckRatio);
  }

  /** master(共有)へ接続した BGM 用 gain を生成する。 */
  private createGain(ctx: AudioContext, initial: number): GainNode {
    const engine = getSharedAudioEngine();
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, initial);
    gain.connect(engine.masterGain() ?? ctx.destination);
    return gain;
  }

  /** 現在の gain を実効音量へ反映する(任意でフェード)。 */
  private applyGain(fadeSec = 0): void {
    if (!this.gain) return;
    const ctx = this.gain.context;
    const now = ctx.currentTime;
    const g = this.gain.gain;
    const target = this.effective();
    g.cancelScheduledValues(now);
    if (fadeSec > 0) {
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(target, now + fadeSec);
    } else {
      g.setValueAtTime(target, now);
    }
  }

  /** 既存ノードを停止して破棄する(任意でフェードアウト)。 */
  private teardown(fadeOutSec = 0): void {
    const node = this.node;
    const gain = this.gain;
    this.node = null;
    this.gain = null;
    this.currentUrl = null;
    if (!node) return;
    const ctx = gain?.context ?? node.context;
    const now = ctx.currentTime;
    const stopAt = now + Math.max(0, fadeOutSec);
    if (gain && fadeOutSec > 0) {
      const g = gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, stopAt);
    }
    node.onended = () => {
      try {
        node.disconnect();
        gain?.disconnect();
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

  async preload(fileName: string): Promise<void> {
    if (!AudioEngine.isSupported()) return;
    let ctx: AudioContext;
    try {
      ctx = getSharedAudioEngine().ensure();
    } catch {
      return;
    }
    try {
      await decodeAudio(ctx, resolveAudioUrl(fileName));
    } catch {
      /* preload 失敗は黙殺(再生時に再試行される) */
    }
  }

  async play(fileName: string, opts: { loop?: boolean; volume?: number; fadeInSec?: number } = {}): Promise<void> {
    if (!AudioEngine.isSupported()) return;
    try {
      const engine = getSharedAudioEngine();
      const ctx = engine.ensure();
      if (ctx.state === "suspended") await ctx.resume();

      const url = resolveAudioUrl(fileName);
      const buf = await decodeAudio(ctx, url);

      if (opts.volume != null) this.baseVolume = Math.max(0, opts.volume);
      this.loop = opts.loop ?? true;

      // 既存トラックはハードカットで停止(crossfade は crossfade() を使う)
      this.teardown();

      const fadeIn = Math.max(0, opts.fadeInSec ?? 0);
      const gain = this.createGain(ctx, fadeIn > 0 ? 0 : this.effective());
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.loop = this.loop;
      node.connect(gain);

      this.node = node;
      this.gain = gain;
      this.currentUrl = url;

      node.start();
      if (fadeIn > 0) this.applyGain(fadeIn);
    } catch {
      /* 取得失敗・未対応などは無音にフォールバック */
    }
  }

  stop(opts: { fadeOutSec?: number } = {}): void {
    this.teardown(opts.fadeOutSec ?? 0);
  }

  setVolume(volume: number): void {
    this.baseVolume = Math.max(0, volume);
    this.applyGain();
  }

  duck(ratio: number, fadeSec = 0): void {
    this.duckRatio = Math.max(0, ratio);
    this.applyGain(fadeSec);
  }

  async crossfade(fileName: string, opts: { durationSec?: number; volume?: number } = {}): Promise<void> {
    if (!AudioEngine.isSupported()) return;
    try {
      const engine = getSharedAudioEngine();
      const ctx = engine.ensure();
      if (ctx.state === "suspended") await ctx.resume();

      const url = resolveAudioUrl(fileName);
      const buf = await decodeAudio(ctx, url);

      if (opts.volume != null) this.baseVolume = Math.max(0, opts.volume);
      const dur = Math.max(0, opts.durationSec ?? 1);
      const now = ctx.currentTime;
      const target = this.effective();

      // 新トラック: 0 から target へフェードイン
      const newGain = this.createGain(ctx, 0);
      const newNode = ctx.createBufferSource();
      newNode.buffer = buf;
      newNode.loop = this.loop;
      newNode.connect(newGain);
      newNode.start(now);
      if (dur > 0) {
        newGain.gain.setValueAtTime(0, now);
        newGain.gain.linearRampToValueAtTime(target, now + dur);
      } else {
        newGain.gain.setValueAtTime(target, now);
      }

      // 旧トラック: target→0 へフェードアウトしてスケジュール停止
      const oldNode = this.node;
      const oldGain = this.gain;
      if (oldNode) {
        if (oldGain && dur > 0) {
          const g = oldGain.gain;
          g.cancelScheduledValues(now);
          g.setValueAtTime(g.value, now);
          g.linearRampToValueAtTime(0, now + dur);
        }
        oldNode.onended = () => {
          try {
            oldNode.disconnect();
            oldGain?.disconnect();
          } catch {
            /* noop */
          }
        };
        try {
          oldNode.stop(now + dur);
        } catch {
          /* noop */
        }
      }

      this.node = newNode;
      this.gain = newGain;
      this.currentUrl = url;
    } catch {
      /* 取得失敗・未対応などは無音にフォールバック */
    }
  }

  isPlaying(): boolean {
    return this.node !== null;
  }

  current(): string | null {
    return this.currentUrl;
  }
}

/** アプリ共有の BGM コントローラ(1 チャンネル)。 */
const controller = new BgmController();

/** BGM を事前デコードしてキャッシュする(初回の立ち上がり遅延を解消)。 */
export function preloadBgm(fileName: string): Promise<void> {
  return controller.preload(fileName);
}

/** BGM のループ再生を開始する(デコード済みなら即時)。既存トラックはハードカットで停止。 */
export function playBgm(
  fileName: string,
  opts?: { loop?: boolean; volume?: number; fadeInSec?: number },
): Promise<void> {
  return controller.play(fileName, opts);
}

/** BGM を停止する(任意でフェードアウト)。 */
export function stopBgm(opts?: { fadeOutSec?: number }): void {
  controller.stop(opts);
}

/** BGM の基準音量(0.0〜1.0)を設定する。ダッキング比率と掛け合わせて反映。 */
export function setBgmVolume(volume: number): void {
  controller.setVolume(volume);
}

/** 演出中などに BGM を一時的に下げる(ratio=0.2 等)。ratio=1 で解除。任意でフェード。 */
export function duckBgm(ratio: number, fadeSec?: number): void {
  controller.duck(ratio, fadeSec);
}

/** BGM トラックを別ファイルへクロスフェードで差し替える(durationSec 既定 1)。 */
export function crossfadeBgm(fileName: string, opts?: { durationSec?: number; volume?: number }): Promise<void> {
  return controller.crossfade(fileName, opts);
}

/** BGM が再生中か(フック側の宣言的ゲート補助)。 */
export function isBgmPlaying(): boolean {
  return controller.isPlaying();
}

/** 現在再生中の BGM トラック URL(なければ null)。 */
export function currentBgm(): string | null {
  return controller.current();
}
