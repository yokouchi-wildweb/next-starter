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

import { AudioEngine } from "@/lib/webAudio";

export type AudioReelOptions = {
  fetcher?: FragmentFetcher;
  /** 共有する AudioEngine。渡すと context を使い回し、destroy では閉じない(フックで永続化する用途) */
  engine?: AudioEngine;
  onError?: (error: Error) => void;
  onLog?: (message: string) => void;
  /**
   * 無音ウォッチドッグの監視間隔(ms)。再生中なのに鳴っているノードが無い状態を検出し、
   * 現在位置から自動復帰させる。0 以下で無効化。既定 250。
   */
  watchdogIntervalMs?: number;
  /**
   * スケジュールの最小先読み(秒)。実効リードは max(minScheduleLeadSec, frame×rate) で
   * 高レート/低スペック時も when が過去落ちしにくくする。既定 0.05。
   */
  minScheduleLeadSec?: number;
};

/** スケジュール済みノード 1 件の追跡情報(ノード↔フラグメント対応 + 無音検出/レート追従用の時刻)。 */
type ScheduledNode = {
  node: AudioBufferSourceNode;
  /** このノードが担うフラグメント index */
  index: number;
  /** 再生開始の context 時刻 */
  when: number;
  /** 開始時のバッファ内オフセット秒(catch-up で途中から鳴らした分) */
  bufferOffset: number;
  /** 終了の context 時刻(現行 rate 基準。レート変更時に引き直す) */
  endTime: number;
};

/** setRate のクランプ範囲(0.25〜4x)。範囲外/不正値は丸める。 */
export const MIN_PLAYBACK_RATE = 0.25;
export const MAX_PLAYBACK_RATE = 4;
/** 再生レートを許容範囲にクランプする(NaN/Infinity は等速へフォールバック)。 */
export function clampPlaybackRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, rate));
}

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
  /** ctx/master を保持するエンジン。注入された場合は共有(destroy で閉じない) */
  private readonly engine: AudioEngine;
  private readonly ownsEngine: boolean;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 1;

  /** フラグメント index ごとのデコード済みバッファ(未デコード/退避後は null) */
  private slots: (AudioBuffer | null)[] = [];
  /** フラグメント尺(秒)。バッファ退避後も保持し、オフセット算出を壊さない */
  private fragDurations: (number | undefined)[] = [];
  /** ワンショット SE のデコードキャッシュ(URL キー) */
  private seCache = new Map<string, AudioBuffer>();
  /** スキップされた(フラグメントごと欠落)index。スケジュールで読み飛ばす */
  private skipped = new Set<number>();

  private activeNodes: ScheduledNode[] = [];
  private scheduledIndex = 0;
  private startContextTime = 0;
  private startReelOffset = 0;
  private playing = false;
  /** フラグメント音声の再生レート(早送り)。reel 時間は context 時間の rate 倍速で進む */
  private rate = 1;
  /** マスターミュート(volume を保持したまま無音化。早送り中のピッチ上昇音を消す用途) */
  private muted = false;
  /**
   * 世代トークン。start/reschedule/stop 等で increment し、await を跨ぐ古い start() の結果を破棄して
   * 連続レート変更時の再スケジュール競合(直前に組んだノードを後発が止めて無音化)を防ぐ。
   */
  private generation = 0;
  /** 無音ウォッチドッグの interval ハンドル(再生中のみ稼働) */
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;

  // BGM(別レイヤー)
  private bgmBuffer: AudioBuffer | null = null;
  private bgmGain: GainNode | null = null;
  private bgmNode: AudioBufferSourceNode | null = null;
  private bgmVolume = 1;
  private bgmLoop = true;

  constructor(options: AudioReelOptions = {}) {
    this.options = options;
    // engine 注入時は共有(閉じない)、未注入時は自前生成して destroy で閉じる(後方互換)
    this.engine = options.engine ?? new AudioEngine();
    this.ownsEngine = !options.engine;
  }

  static isSupported(): boolean {
    return AudioEngine.isSupported();
  }

  async unlock(): Promise<void> {
    await this.engine.unlock();
  }

  private ensureContext(): AudioContext {
    this.ctx = this.engine.ensure();
    this.masterGain = this.engine.masterGain();
    return this.ctx;
  }

  // --- スロット / 読み込み ---

  init(count: number): void {
    this.slots = new Array(count).fill(null);
    this.fragDurations = new Array(count).fill(undefined);
    this.skipped.clear();
    this.scheduledIndex = 0;
  }

  private ensureSlot(index: number): void {
    while (this.slots.length <= index) this.slots.push(null);
    while (this.fragDurations.length <= index) this.fragDurations.push(undefined);
  }

  setBuffer(index: number, buffer: AudioBuffer): void {
    this.ensureSlot(index);
    this.slots[index] = buffer;
    this.fragDurations[index] = buffer.duration;
    this.log(
      `音声#${index + 1}: ${buffer.duration.toFixed(2)}s / ${buffer.sampleRate}Hz / ${buffer.numberOfChannels}ch / peak=${peakAmplitude(buffer).toFixed(3)}`,
    );
    if (this.playing) this.trySchedule();
  }

  async decodeInto(index: number, source: SeamlessFragmentSource): Promise<void> {
    const decoded = await this.decode(source);
    this.setBuffer(index, decoded);
  }

  /** ソースをデコードして AudioBuffer を返す(スロットには格納しない)。 */
  async decode(source: SeamlessFragmentSource): Promise<AudioBuffer> {
    const ctx = this.ensureContext();
    const buf = await toArrayBuffer(source, this.options.fetcher);
    return ctx.decodeAudioData(buf.slice(0));
  }

  /** 指定フラグメントを欠落(尺 0)として扱い、スケジュールで読み飛ばす(skip 回復用)。 */
  markSkipped(index: number): void {
    this.ensureSlot(index);
    this.fragDurations[index] = 0;
    this.slots[index] = null;
    this.skipped.add(index);
    if (this.playing) this.trySchedule();
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
    return this.fragDurations.map((d) => d ?? 0);
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
    return this.fragDurations.reduce<number>((s, d) => s + (d ?? 0), 0);
  }
  get isPlaying(): boolean {
    return this.playing;
  }
  get contextState(): string {
    return this.engine.state;
  }
  get scheduledCount(): number {
    return this.activeNodes.length;
  }

  /** フラグメント i の reel 開始位置(秒)。0..i-1 の尺が判明していなければ null(尺はバッファ退避後も保持)。 */
  fragmentOffset(index: number): number | null {
    let acc = 0;
    for (let k = 0; k < index; k++) {
      const d = this.fragDurations[k];
      if (d == null) return null;
      acc += d;
    }
    return acc;
  }

  fragmentIndexAt(reelSec: number): number {
    let acc = 0;
    for (let i = 0; i < this.fragDurations.length; i++) {
      const d = this.fragDurations[i];
      if (d == null) return -1;
      if (reelSec < acc + d) return i;
      acc += d;
    }
    return Math.max(0, this.fragDurations.length - 1);
  }

  /** 再生済みで古くなったフラグメントのデコードバッファを破棄してメモリを解放する(長尺 open 用)。 */
  evictBehind(currentReelSec: number, keepSec: number): void {
    const threshold = currentReelSec - keepSec;
    if (threshold <= 0) return;
    for (let i = 0; i < this.scheduledIndex && i < this.slots.length; i++) {
      if (!this.slots[i]) continue; // 既に破棄済み
      const off = this.fragmentOffset(i);
      const d = this.fragDurations[i];
      if (off == null || d == null) break;
      if (off + d < threshold) {
        // 既にスケジュール済み(再生中ノードは自前で buffer 参照を保持)なので破棄して安全
        this.slots[i] = null;
      } else {
        break; // まだ必要な範囲に到達
      }
    }
  }

  // --- 音量 / フェード(マスター) ---

  setVolume(v: number): void {
    this.volume = Math.max(0, v);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      // muted 中は volume を保持したまま出力だけ 0(復音時に元の音量へ戻す)
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
  }

  /** 現在の音量から target へ durationSec かけてフェード。 */
  fade(target: number, durationSec: number): void {
    this.volume = Math.max(0, target);
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const g = this.masterGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    // muted 中は無音を維持(volume だけ更新し、復音時に setMuted(false) で反映)
    g.linearRampToValueAtTime(this.muted ? 0 : this.volume, now + Math.max(0, durationSec));
  }

  /** マスター出力のミュート切替(volume は保持。早送り中のピッチ上昇音を消す用途)。 */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.value = muted ? 0 : this.volume;
    }
  }
  get isMuted(): boolean {
    return this.muted;
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

  // --- ワンショット SE(効果音) ---

  private async decodeSe(source: SeamlessFragmentSource): Promise<AudioBuffer> {
    const key = typeof source === "string" ? source : null;
    if (key && this.seCache.has(key)) return this.seCache.get(key)!;
    const ctx = this.ensureContext();
    const ab = await toArrayBuffer(source, this.options.fetcher);
    const buf = await ctx.decodeAudioData(ab.slice(0));
    if (key) this.seCache.set(key, buf);
    return buf;
  }

  /**
   * 効果音を 1 回再生する。atFragment 指定かつ再生中なら、そのフラグメント境界に合わせてスケジュールする。
   * 必ずユーザー操作起点の後(unlock 済み)で呼ぶこと。
   */
  async playSe(source: SeamlessFragmentSource, opts: { atFragment?: number; volume?: number } = {}): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
    const buf = await this.decodeSe(source);

    const gain = ctx.createGain();
    gain.gain.value = opts.volume ?? 1;
    gain.connect(ctx.destination);

    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.connect(gain);

    let when = ctx.currentTime;
    if (opts.atFragment != null && this.playing) {
      const off = this.fragmentOffset(opts.atFragment);
      if (off != null) {
        // フラグメント境界の reel 位置を rate 込みで context 時刻へ写像する(早送り中も整合)。
        const t = this.startContextTime + (off - this.startReelOffset) / this.rate;
        if (t > ctx.currentTime) when = t;
      }
    }
    node.onended = () => {
      try {
        node.disconnect();
        gain.disconnect();
      } catch {
        /* noop */
      }
    };
    node.start(when);
  }

  // --- 再生制御(フラグメント音声) ---

  get playbackRate(): number {
    return this.rate;
  }

  /**
   * フラグメント音声の再生レートを変更する(早送り/スロー)。範囲は 0.25〜4x にクランプ。
   * 再生中は teardown せず、再生中の現在フラグメントノードは playbackRate をライブ変更で追従させ、
   * 「まだ start していない先のフラグメント」だけを再スケジュールする(継ぎ目・無音・カクつきを構造的に回避)。
   * 音程(ピッチ)は rate に比例して変化する(等ピッチ化はしない)。
   */
  setRate(rate: number): void {
    const clamped = clampPlaybackRate(rate);
    if (clamped === this.rate) return;
    if (!this.playing) {
      this.rate = clamped;
      return;
    }
    this.reschedule(clamped);
  }

  /** 実効スケジュールリード(秒)。高レート/低スペックで when が過去落ちしないよう rate に応じて伸ばす。 */
  private scheduleLead(): number {
    const min = this.options.minScheduleLeadSec ?? 0.05;
    const frame = 1 / 60;
    return Math.max(min, frame * this.rate);
  }

  /**
   * 再生を止めずにレートを切り替える(レート据え置きでの呼び出しは「現在位置からの再 attach」=空スケジュール
   * 自動リカバリにも使う)。再生中の現在フラグメントノードは playbackRate をライブ変更し、未来の予約ノードだけ
   * 組み直す。アンカーを現時刻へ再固定するため、残したノードの終端と次フラグメント開始が一致し継ぎ目が出ない。
   */
  private reschedule(newRate: number): void {
    const ctx = this.ctx;
    const out = this.masterGain;
    if (!ctx || !out) {
      this.rate = newRate;
      return;
    }
    // 古い start()/再スケジュールの結果を破棄する(連続呼び出しの競合ガード)
    this.generation += 1;
    const now = ctx.currentTime;
    const pos = this.currentTime(); // 旧アンカーでの現在 reel 位置
    const oldRate = this.rate;
    const cur = this.fragmentIndexAt(pos);

    // 再生中の現在フラグメントノードだけ残してライブ追従。それ以外(未来予約ノード等)は停止する。
    let kept: ScheduledNode | null = null;
    const survivors: ScheduledNode[] = [];
    for (const entry of this.activeNodes) {
      const started = entry.when <= now;
      const sounding = started && now < entry.endTime;
      if (kept === null && sounding && entry.index === cur && entry.node.buffer) {
        try {
          entry.node.playbackRate.cancelScheduledValues(now);
          entry.node.playbackRate.setValueAtTime(newRate, now);
          // 残ノードの終端を新レートで引き直す(これ以降の継ぎ目算出の基準)
          const playedBuf = entry.bufferOffset + (now - entry.when) * oldRate;
          const remaining = Math.max(0, entry.node.buffer.duration - playedBuf);
          entry.endTime = now + remaining / newRate;
          kept = entry;
          survivors.push(entry);
          continue;
        } catch {
          /* ライブ変更に失敗したら停止側へフォールバック */
        }
      }
      try {
        entry.node.onended = null;
        entry.node.stop();
        entry.node.disconnect();
      } catch {
        /* 既に停止済みは無視 */
      }
    }
    this.activeNodes = survivors;

    // アンカーを現時刻へ再固定。残ノードの終端 = 新アンカーで算出する次フラグメント開始 と一致する。
    this.rate = newRate;
    this.startReelOffset = pos;
    this.startContextTime = now;
    // 残せたら次フラグメントから、残せなければ現在フラグメントを catch-up 経路で鳴らし直す
    this.scheduledIndex = kept ? kept.index + 1 : 0;
    this.trySchedule();
    this.ensureWatchdog();
  }

  async start(reelOffsetSec = 0): Promise<void> {
    const ctx = this.ensureContext();
    const gen = ++this.generation;
    if (ctx.state === "suspended") await ctx.resume();
    if (gen !== this.generation) return; // より新しい操作に追い越された(古い start を破棄)
    this.stopNodes();

    const lead = this.scheduleLead();
    this.startContextTime = ctx.currentTime + lead;
    this.startReelOffset = reelOffsetSec;
    this.scheduledIndex = 0;
    this.playing = true;
    this.trySchedule();
    this.ensureWatchdog();
  }

  private trySchedule(): void {
    const ctx = this.ctx;
    const out = this.masterGain;
    if (!ctx || !out || !this.playing) return;

    while (this.scheduledIndex < this.slots.length) {
      const i = this.scheduledIndex;
      const buf = this.slots[i];
      if (!buf) {
        // skip 済みは読み飛ばす。未デコードは到着待ちで停止
        if (this.skipped.has(i)) {
          this.scheduledIndex += 1;
          continue;
        }
        break;
      }

      const fragStart = this.fragmentOffset(i);
      if (fragStart === null) break;

      const fragEnd = fragStart + buf.duration;
      if (fragEnd <= this.startReelOffset) {
        this.scheduledIndex += 1;
        continue;
      }

      // reel 時間で組んだスケジュールを /rate で context 時刻へ写像する(rate 倍速ぶん前倒し)。
      const desired = this.startContextTime + (fragStart - this.startReelOffset) / this.rate;
      let when: number;
      let bufferOffset: number;
      if (desired >= ctx.currentTime) {
        when = desired;
        bufferOffset = 0;
      } else {
        // 既に開始時刻を過ぎている分はバッファ内オフセット(reel/buffer 秒。速度は playbackRate が吸収)で詰める。
        const reelPos = this.startReelOffset + (ctx.currentTime - this.startContextTime) * this.rate;
        const skip = reelPos - fragStart;
        if (skip >= buf.duration) {
          this.scheduledIndex += 1;
          continue;
        }
        when = ctx.currentTime;
        bufferOffset = Math.max(0, skip);
      }

      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.playbackRate.value = this.rate;
      node.connect(out);
      // when が過去にならないようクランプ(高レート/負荷時の取りこぼし防止)
      const safeWhen = Math.max(when, ctx.currentTime);
      try {
        node.start(safeWhen, bufferOffset);
      } catch (e) {
        this.options.onError?.(e instanceof Error ? e : new Error("音声スケジュールに失敗しました"));
      }
      const endTime = safeWhen + Math.max(0, buf.duration - bufferOffset) / this.rate;
      this.activeNodes.push({ node, index: i, when: safeWhen, bufferOffset, endTime });
      this.scheduledIndex += 1;
    }
  }

  currentTime(): number {
    if (!this.ctx || !this.playing) return this.startReelOffset;
    return this.startReelOffset + (this.ctx.currentTime - this.startContextTime) * this.rate;
  }

  async pause(): Promise<void> {
    // in-flight な start() を無効化(復帰時に playing を勝手に true へ戻させない)
    this.generation += 1;
    this.clearWatchdog();
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
    this.ensureWatchdog();
  }

  stop(): void {
    this.generation += 1;
    this.clearWatchdog();
    this.stopNodes();
    this.playing = false;
    this.scheduledIndex = 0;
  }

  async destroy(): Promise<void> {
    this.generation += 1;
    this.clearWatchdog();
    this.stopNodes();
    this.stopBgm();
    if (this.bgmGain) {
      try {
        this.bgmGain.disconnect();
      } catch {
        /* noop */
      }
      this.bgmGain = null;
    }
    this.slots = [];
    this.fragDurations = [];
    this.skipped.clear();
    this.seCache.clear();
    this.bgmBuffer = null;
    this.playing = false;
    this.rate = 1;
    this.muted = false;
    // 共有 master はリール跨ぎで残るため、mute/フェードの痕跡を中立(1)へ戻してから手放す
    // (次リールが無音や減衰を継承しないように)。
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.value = 1;
      } catch {
        /* noop */
      }
    }
    this.volume = 1;
    // 共有 engine のときは context を閉じない(フックが unmount/reset で閉じる)
    if (this.ownsEngine) {
      await this.engine.close();
    }
    this.ctx = null;
    this.masterGain = null;
  }

  private stopNodes(): void {
    for (const { node } of this.activeNodes) {
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

  // --- 無音ウォッチドッグ ---

  /** 再生中の監視 interval を起動する(多重起動・無効設定はスキップ)。 */
  private ensureWatchdog(): void {
    const ms = this.options.watchdogIntervalMs ?? 250;
    if (ms <= 0 || this.watchdogTimer != null) return;
    this.watchdogTimer = setInterval(() => this.watchdogTick(), ms);
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer != null) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  /**
   * 再生中なのにアクティブな音声ノードが無い状態を検出し、現在位置から自動復帰させる。
   * 未デコード待ち(該当フラグメントのバッファ未到着)は正当な無音として除外する。
   */
  private watchdogTick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.playing || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const reel = this.currentTime();
    if (reel >= this.duration - 0.05) return; // 末尾付近は対象外
    const cur = this.fragmentIndexAt(reel);
    if (cur < 0 || !this.slots[cur]) return; // 未デコード待ちの無音は正当
    const sounding = this.activeNodes.some((e) => e.when <= now && now < e.endTime);
    if (sounding) return;
    // 鳴っているべきなのに無音 → 現在位置から再 attach(レート据え置き)
    this.log(`無音検出: ${reel.toFixed(2)}s から自動復帰`);
    this.reschedule(this.rate);
  }

  private log(message: string): void {
    this.options.onLog?.(message);
  }
}
