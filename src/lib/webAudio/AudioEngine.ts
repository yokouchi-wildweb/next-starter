// src/lib/webAudio/AudioEngine.ts
//
// AudioContext とマスター GainNode を保持する小さなホルダ(アプリ共通の「音響の土台」)。
// インスタンスを 1 つ生成して使い回し、複数機能(効果音 / 連結動画の音声 / BGM 等)で
// 同一の AudioContext を共有させることで、iOS Safari のオーディオセッション競合
// (複数 AudioContext の取り合いで片方が鳴らない / 途切れる)を構造的に回避する。
//
// AudioContext はユーザー操作起点でしか開始できない(モバイルの自動再生制約)。
// 最初の確実なタップ等の同期内で一度 unlock() しておけば、以降は await 後(gesture 外)でも鳴る。

type AudioContextCtor = typeof AudioContext;

export function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  static isSupported(): boolean {
    return getAudioContextCtor() !== null;
  }

  /** ctx + master を(無ければ)同期生成して ctx を返す。 */
  ensure(): AudioContext {
    if (!this.ctx) {
      const Ctor = getAudioContextCtor();
      if (!Ctor) throw new Error("この環境は Web Audio(AudioContext)に対応していません");
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  context(): AudioContext | null {
    return this.ctx;
  }

  masterGain(): GainNode | null {
    return this.master;
  }

  get state(): string {
    return this.ctx?.state ?? "none";
  }

  /** ctx を生成して resume する。必ずユーザー操作の同期内から呼ぶこと。冪等。 */
  async unlock(): Promise<void> {
    if (!AudioEngine.isSupported()) return;
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
  }

  /** ctx を閉じて解放する(unmount / reset 時)。 */
  async close(): Promise<void> {
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* noop */
      }
      this.ctx = null;
      this.master = null;
    }
  }
}
