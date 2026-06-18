// src/lib/seamlessVideo/core/AudioReel.ts
//
// 各フラグメント固有の音声を Web Audio API でギャップレスに連結再生するスケジューラ。
// 圧縮音声を decodeAudioData で PCM(AudioBuffer)に展開し、AudioContext のオーディオクロックに対して
// サンプル精度で back-to-back にスケジュールする(継ぎ目が構造的にゼロ)。
//
// スロットモデル:
//   - フラグメント数ぶんのスロットを持ち、デコード済みバッファが入った分だけ「連続する先頭から」順に
//     スケジュールしていく。プログレッシブ読み込み(後からバッファが届く)に対応。
//   - 全ノードはマスター GainNode を経由するため、音量・フェードを一括制御できる。
//   - 連続 BGM を別レイヤーとして重ねられる(デコード済みバッファをループ再生、独立した音量/フェード)。
//
// AudioContext はユーザー操作起点でしか開始できない(モバイルの自動再生制約)。
// start()/unlock()/playBgm() は内部で resume() するため、必ずクリック等のジェスチャ内から呼ぶこと。

import type { FragmentFetcher, SeamlessFragmentSource } from "../types";
import { toArrayBuffer } from "./fragmentBytes";

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export type AudioReelOptions = {
  fetcher?: FragmentFetcher;
  onError?: (error: Error) => void;
  onLog?: (message: string) => void;
};

/** バッファのピーク振幅(無音判定用)。負荷軽減のため間引いて走査する。 */
function peakAmplitude(buffer: AudioBuffer): number {
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    const step = Math.max(1, Math.floor(data.length / 10000));
    for (let i = 0; i < data.length; i += step) {
      const a = Math.abs(data[i]);
      if (a > peak) peak = a;
    }
  }
  return peak;
}

export class AudioReel {
  private readonly options: AudioReelOptions;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 1;

  /** フラグメント index ごとのデコード済みバッファ(未デコードは null) */
  private slots: (AudioBuffer | null)[] = [];

  private activeNodes: AudioBufferSourceNode[] = [];
  private scheduledIndex = 0;
  private startContextTime = 0;
  private startReelOffset = 0;
  private playing = false;

  // BGM(別レイヤー)
  private bgmBuffer: AudioBuffer | null = null;
  private bgmGain: GainNode | null = null;
  private bgmNode: AudioBufferSourceNode | null = null;
  private bgmVolume = 1;
  private bgmLoop = true;

  constructor(options: AudioReelOptions = {}) {
    this.options = options;
  }

  static isSupported(): boolean {
    return getAudioContextCtor() !== null;
  }

  async unlock(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor = getAudioContextCtor();
      if (!Ctor) throw new Error("この環境は Web Audio(AudioContext)に対応していません");
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  // --- スロット / 読み込み ---

  init(count: number): void {
    this.slots = new Array(count).fill(null);
    this.scheduledIndex = 0;
  }

  private ensureSlot(index: number): void {
    while (this.slots.length <= index) this.slots.push(null);
  }

  setBuffer(index: number, buffer: AudioBuffer): void {
    this.ensureSlot(index);
    this.slots[index] = buffer;
    this.log(
      `音声#${index + 1}: ${buffer.duration.toFixed(2)}s / ${buffer.sampleRate}Hz / ${buffer.numberOfChannels}ch / peak=${peakAmplitude(buffer).toFixed(3)}`,
    );
    if (this.playing) this.trySchedule();
  }

  async decodeInto(index: number, source: SeamlessFragmentSource): Promise<void> {
    const ctx = this.ensureContext();
    const buf = await toArrayBuffer(source, this.options.fetcher);
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    this.setBuffer(index, decoded);
  }

  /** 末尾に 1 スロット追加してデコードする(動的シーケンス用)。追加した index を返す。 */
  async pushDecode(source: SeamlessFragmentSource): Promise<number> {
    const index = this.slots.length;
    this.ensureSlot(index);
    await this.decodeInto(index, source);
    return index;
  }

  async load(sources: SeamlessFragmentSource[]): Promise<void> {
    const ctx = this.ensureContext();
    this.init(sources.length);
    await Promise.all(
      sources.map(async (src, i) => {
        const buf = await toArrayBuffer(src, this.options.fetcher);
        const decoded = await ctx.decodeAudioData(buf.slice(0));
        this.setBuffer(i, decoded);
      }),
    );
  }

  // --- 情報 ---

  get durations(): number[] {
    return this.slots.map((b) => b?.duration ?? 0);
  }
  get loadedCount(): number {
    return this.slots.reduce((n, b) => n + (b ? 1 : 0), 0);
  }
  hasBuffer(index: number): boolean {
    return !!this.slots[index];
  }
  get count(): number {
    return this.slots.length;
  }
  get duration(): number {
    return this.slots.reduce((s, b) => s + (b?.duration ?? 0), 0);
  }
  get isPlaying(): boolean {
    return this.playing;
  }
  get contextState(): string {
    return this.ctx?.state ?? "none";
  }
  get scheduledCount(): number {
    return this.activeNodes.length;
  }

  /** フラグメント i の reel 開始位置(秒)。0..i-1 が連続デコード済みでなければ null。 */
  fragmentOffset(index: number): number | null {
    let acc = 0;
    for (let k = 0; k < index; k++) {
      const b = this.slots[k];
      if (!b) return null;
      acc += b.duration;
    }
    return acc;
  }

  fragmentIndexAt(reelSec: number): number {
    let acc = 0;
    for (let i = 0; i < this.slots.length; i++) {
      const b = this.slots[i];
      if (!b) return -1;
      if (reelSec < acc + b.duration) return i;
      acc += b.duration;
    }
    return Math.max(0, this.slots.length - 1);
  }

  // --- 音量 / フェード(マスター) ---

  setVolume(v: number): void {
    this.volume = Math.max(0, v);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.value = this.volume;
    }
  }

  /** 現在の音量から target へ durationSec かけてフェード。 */
  fade(target: number, durationSec: number): void {
    if (!this.ctx || !this.masterGain) {
      this.volume = Math.max(0, target);
      return;
    }
    const now = this.ctx.currentTime;
    const g = this.masterGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(Math.max(0, target), now + Math.max(0, durationSec));
    this.volume = Math.max(0, target);
  }

  // --- BGM(別レイヤー) ---

  /** 連続 BGM をデコードして保持する(再生は playBgm)。 */
  async setBgm(source: SeamlessFragmentSource, opts: { loop?: boolean; volume?: number } = {}): Promise<void> {
    const ctx = this.ensureContext();
    this.bgmLoop = opts.loop ?? true;
    if (opts.volume != null) this.bgmVolume = Math.max(0, opts.volume);
    const buf = await toArrayBuffer(source, this.options.fetcher);
    this.bgmBuffer = await ctx.decodeAudioData(buf.slice(0));
  }

  async playBgm(): Promise<void> {
    if (!this.bgmBuffer) return;
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
    this.stopBgm();
    if (!this.bgmGain) {
      this.bgmGain = ctx.createGain();
      this.bgmGain.connect(ctx.destination);
    }
    this.bgmGain.gain.value = this.bgmVolume;
    const node = ctx.createBufferSource();
    node.buffer = this.bgmBuffer;
    node.loop = this.bgmLoop;
    node.connect(this.bgmGain);
    node.start();
    this.bgmNode = node;
  }

  stopBgm(): void {
    if (this.bgmNode) {
      try {
        this.bgmNode.onended = null;
        this.bgmNode.stop();
        this.bgmNode.disconnect();
      } catch {
        /* 既に停止済みは無視 */
      }
      this.bgmNode = null;
    }
  }

  setBgmVolume(v: number): void {
    this.bgmVolume = Math.max(0, v);
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bgmGain.gain.value = this.bgmVolume;
    }
  }

  fadeBgm(target: number, durationSec: number): void {
    if (!this.ctx || !this.bgmGain) {
      this.bgmVolume = Math.max(0, target);
      return;
    }
    const now = this.ctx.currentTime;
    const g = this.bgmGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(Math.max(0, target), now + Math.max(0, durationSec));
    this.bgmVolume = Math.max(0, target);
  }

  // --- 再生制御(フラグメント音声) ---

  async start(reelOffsetSec = 0): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
    this.stopNodes();

    const lead = 0.05;
    this.startContextTime = ctx.currentTime + lead;
    this.startReelOffset = reelOffsetSec;
    this.scheduledIndex = 0;
    this.playing = true;
    this.trySchedule();
  }

  private trySchedule(): void {
    const ctx = this.ctx;
    const out = this.masterGain;
    if (!ctx || !out || !this.playing) return;

    while (this.scheduledIndex < this.slots.length) {
      const i = this.scheduledIndex;
      const buf = this.slots[i];
      if (!buf) break;

      const fragStart = this.fragmentOffset(i);
      if (fragStart === null) break;

      const fragEnd = fragStart + buf.duration;
      if (fragEnd <= this.startReelOffset) {
        this.scheduledIndex += 1;
        continue;
      }

      const desired = this.startContextTime + (fragStart - this.startReelOffset);
      let when: number;
      let bufferOffset: number;
      if (desired >= ctx.currentTime) {
        when = desired;
        bufferOffset = 0;
      } else {
        const skip = ctx.currentTime - this.startContextTime + this.startReelOffset - fragStart;
        if (skip >= buf.duration) {
          this.scheduledIndex += 1;
          continue;
        }
        when = ctx.currentTime;
        bufferOffset = Math.max(0, skip);
      }

      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.connect(out);
      try {
        node.start(when, bufferOffset);
      } catch (e) {
        this.options.onError?.(e instanceof Error ? e : new Error("音声スケジュールに失敗しました"));
      }
      this.activeNodes.push(node);
      this.scheduledIndex += 1;
    }
  }

  currentTime(): number {
    if (!this.ctx || !this.playing) return this.startReelOffset;
    return this.startReelOffset + (this.ctx.currentTime - this.startContextTime);
  }

  async pause(): Promise<void> {
    if (this.ctx && this.ctx.state === "running") {
      const pos = this.currentTime();
      await this.ctx.suspend();
      this.startReelOffset = pos;
      this.startContextTime = this.ctx.currentTime;
    }
    this.playing = false;
  }

  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === "suspended") await this.ctx.resume();
    this.playing = true;
  }

  stop(): void {
    this.stopNodes();
    this.playing = false;
    this.scheduledIndex = 0;
  }

  async destroy(): Promise<void> {
    this.stopNodes();
    this.stopBgm();
    this.slots = [];
    this.bgmBuffer = null;
    this.playing = false;
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* noop */
      }
      this.ctx = null;
      this.masterGain = null;
      this.bgmGain = null;
    }
  }

  private stopNodes(): void {
    for (const node of this.activeNodes) {
      try {
        node.onended = null;
        node.stop();
        node.disconnect();
      } catch {
        /* 既に停止済みは無視 */
      }
    }
    this.activeNodes = [];
  }

  private log(message: string): void {
    this.options.onLog?.(message);
  }
}
