// src/lib/seamlessVideo/core/AudioEngine.ts
//
// AudioContext とマスター GainNode を保持する小さなホルダ。
// useSeamlessReel のフックインスタンス内で 1 つだけ生成して使い回し、load() を跨いで context を生存させる。
// これにより「開始タップ(ユーザー操作)で一度 unlock() しておけば、以降は await 後(gesture 外)の
// play() でも音が鳴る」状態を作れる(モバイルの自動再生制約への対応)。

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
