// src/lib/seamlessVideo/core/SeamlessReel.ts
//
// 「各フラグメント固有の音声を持つ動画」を、映像=MSE 連結 / 音声=Web Audio ギャップレス連結 で
// 同時に再生し、両者を同期させる結合コントローラ(方式 B)。
//
// 設計:
//   - 映像と音声は独立した 2 つのクロック(video のメディアクロック / AudioContext のオーディオクロック)。
//   - 同期は「リコンサイル方式」: 一定間隔で video の実状態(paused/seeking/ended/currentTime)を見て音声を合わせる。
//     イベントのエッジ(pause/seeking/waiting 連発)に反応すると音が止まるため、実際の状態に追従させる。
//   - 音声は再スケジュールでプチノイズが出やすいので「音声をマスター」とし、映像側の playbackRate を微調整。
//   - 音は Web Audio から出すため video 要素は常にミュート。
//
// 読み込みモード:
//   - 既定(progressive=false): リール全体を読み込んでから playable(=ready)。
//   - progressive=true: 先頭フラグメントが用意でき次第 playable にし、残りは裏で読み込み+逐次デコード/スケジュール。

import type { FragmentFetcher, ReelFragment, SeamlessFragmentSource } from "../types";
import { SeamlessSource } from "./SeamlessSource";
import { AudioReel } from "./AudioReel";
import { toArrayBuffer } from "./fragmentBytes";

/** 再生状態のスナップショット(UI 構築用)。 */
export type SeamlessReelState = {
  /** 再生可能(progressive では先頭準備時点で true) */
  playable: boolean;
  /** 全フラグメントの読み込み完了 */
  complete: boolean;
  /** 読み込み済み映像フラグメント数 */
  loadedVideo: number;
  /** 読み込み済み音声フラグメント数 */
  loadedAudio: number;
  /** フラグメント総数 */
  total: number;
  /** 現在位置から先にバッファ済みの秒数(video.buffered ベース) */
  bufferedSec: number;
  /** 再生中フラグメント index(不明は -1) */
  currentFragment: number;
};

export type SeamlessReelLoadOptions = {
  /** true で先頭準備時点から再生可能にし、残りを裏で読み込む */
  progressive?: boolean;
  /** true でストリームを閉じず、後から appendFragment() で継ぎ足せるようにする(動的シーケンス用) */
  open?: boolean;
};

export type SeamlessReelOptions = {
  /** 連結に使う映像 MIME。省略時はフラグメントから自動推定 */
  mimeType?: string;
  /** URL ソースのバイト取得を差し替える(認証/キャッシュ/CDN 等) */
  fetcher?: FragmentFetcher;
  /** ソフト同期の許容ドリフト(秒)。超えたら playbackRate で寄せる。既定 0.08 */
  syncThreshold?: number;
  /** ハードリシンクの閾値(秒)。超えたら音声を映像位置へスナップ。既定 0.5 */
  hardResyncThreshold?: number;
  /** リコンサイル(状態追従)ループの間隔(ms)。既定 100 */
  syncIntervalMs?: number;
  /** 連結全体をループ再生する(末尾到達で先頭へ) */
  loop?: boolean;
  onFragmentAppended?: (appended: number, total: number) => void;
  /** A/V ドリフト計測の通知(診断用)。drift = video - audio(秒) */
  onDrift?: (driftSec: number, corrected: boolean) => void;
  /** 再生状態の定期通知(読み込み進捗・バッファ・再生中フラグメント等) */
  onState?: (state: SeamlessReelState) => void;
  /** 再生開始/再開時 */
  onPlay?: () => void;
  /** 一時停止時 */
  onPause?: () => void;
  /** 連結全体の再生終了時(loop 時は発火せず先頭へ戻る) */
  onEnded?: () => void;
  onError?: (error: Error) => void;
  onLog?: (message: string) => void;
};

export class SeamlessReel {
  private readonly video: HTMLVideoElement;
  private readonly options: SeamlessReelOptions;
  private readonly videoSource: SeamlessSource;
  private readonly audioReel: AudioReel;

  private hasAudio = false;
  private total = 0;
  private videoLoaded = 0;
  private audioLoaded = 0;
  private playable = false;
  private complete = false;
  private open = false;
  private playableResolve: (() => void) | null = null;

  private reconcileTimer: ReturnType<typeof setTimeout> | null = null;
  private audioStarting = false;
  private destroyed = false;
  private lifecycleAttached = false;
  private lastEmit: SeamlessReelState | null = null;

  constructor(video: HTMLVideoElement, options: SeamlessReelOptions = {}) {
    this.video = video;
    this.options = options;
    // 音声は Web Audio から出す(二重再生防止)
    this.video.muted = true;

    this.videoSource = new SeamlessSource(video, {
      mimeType: options.mimeType,
      fetcher: options.fetcher,
      onFragmentAppended: options.onFragmentAppended,
      onError: options.onError,
      onLog: options.onLog,
    });
    this.audioReel = new AudioReel({ fetcher: options.fetcher, onError: options.onError, onLog: options.onLog });
  }

  /**
   * フラグメント(映像+音声)を読み込む。全フラグメントに音声があり Web Audio が使える場合のみ
   * 音声連結を有効化する(一部欠落時は映像のみ扱い)。
   * progressive=true では先頭準備時点で resolve し、残りは裏で読み込む。
   */
  async load(fragments: ReelFragment[], opts: SeamlessReelLoadOptions = {}): Promise<void> {
    const progressive = opts.progressive ?? false;
    this.open = opts.open ?? false;
    this.total = fragments.length;
    this.videoLoaded = 0;
    this.audioLoaded = 0;
    this.playable = false;
    this.complete = false;

    const videos = fragments.map((f) => f.video);
    const audios = fragments.map((f) => f.audio).filter((a): a is SeamlessFragmentSource => a != null);
    this.hasAudio = AudioReel.isSupported() && fragments.length > 0 && audios.length === fragments.length;

    // AudioContext の resume はユーザー操作(読み込みボタン等)の同期内で行う必要があるため、ここで実行
    if (this.hasAudio) {
      void this.audioReel.unlock();
      this.audioReel.init(fragments.length);
    }

    this.attachLifecycle();
    this.startReconcileLoop();
    this.log(this.hasAudio ? "音声連結 有効" : "音声連結 無効(映像のみ)");

    if (!progressive) {
      await Promise.all([
        // open のときは endOfStream せず、後から appendFragment できるようにする
        this.videoSource.load(videos, !this.open),
        this.hasAudio ? this.audioReel.load(audios) : Promise.resolve(),
      ]);
      this.videoLoaded = fragments.length;
      this.audioLoaded = this.hasAudio ? fragments.length : 0;
      this.playable = true;
      this.complete = !this.open;
      this.emitState();
      return;
    }

    // progressive: 先頭が用意でき次第 resolve し、残りは裏で読み込む
    await new Promise<void>((resolve) => {
      this.playableResolve = resolve;
      if (fragments.length === 0) {
        this.playable = true;
        resolve();
        return;
      }
      this.runProgressive(videos, this.hasAudio ? audios : []);
    });
  }

  /** 実行時にフラグメントを 1 つ継ぎ足す(load を open:true で行った場合のみ)。 */
  async appendFragment(fragment: ReelFragment): Promise<void> {
    if (!this.open) throw new Error("appendFragment は load({ open: true }) のときのみ利用できます");
    await this.videoSource.append(fragment.video);
    this.videoLoaded += 1;
    this.total = Math.max(this.total, this.videoLoaded);
    if (this.hasAudio && fragment.audio) {
      await this.audioReel.pushDecode(fragment.audio);
      this.audioLoaded += 1;
    }
    this.maybePlayable();
    this.emitState();
  }

  /** open で開始したストリームを確定する(以後 appendFragment 不可、末尾で ended が発火)。 */
  async endReel(): Promise<void> {
    if (!this.open) return;
    await this.videoSource.end();
    this.open = false;
    this.complete = true;
    this.emitState();
  }

  /** 音声連結が有効か。 */
  get audioEnabled(): boolean {
    return this.hasAudio;
  }
  get isPlayable(): boolean {
    return this.playable;
  }
  get isComplete(): boolean {
    return this.complete;
  }
  get videoDuration(): number | null {
    return Number.isFinite(this.video.duration) ? this.video.duration : null;
  }
  get audioDuration(): number | null {
    return this.hasAudio ? this.audioReel.duration : null;
  }
  get audioDurations(): number[] {
    return this.hasAudio ? this.audioReel.durations : [];
  }

  /** 再生開始(ユーザー操作内から呼ぶこと。AudioContext の resume に必要)。 */
  async play(): Promise<void> {
    this.video.muted = true;
    if (this.hasAudio) {
      try {
        await this.audioReel.unlock();
        void this.audioReel.playBgm(); // BGM を設定済みなら一緒に再生
      } catch (e) {
        this.options.onError?.(e instanceof Error ? e : new Error("AudioContext の開始に失敗しました"));
      }
    }
    await this.video.play(); // 音声はリコンサイルループが video の状態に追従して開始する
  }

  pause(): void {
    this.video.pause();
    this.audioReel.stopBgm();
  }

  destroy(): void {
    this.destroyed = true;
    this.playableResolve?.();
    this.playableResolve = null;
    this.stopReconcileLoop();
    this.detachLifecycle();
    this.video.playbackRate = 1;
    void this.audioReel.destroy();
    this.videoSource.destroy();
  }

  // --- 音量 / フェード / BGM ---

  /** フラグメント音声のマスター音量(0..)。 */
  setVolume(v: number): void {
    this.audioReel.setVolume(v);
  }
  /** フラグメント音声を target へ durationSec かけてフェード。 */
  fade(target: number, durationSec: number): void {
    this.audioReel.fade(target, durationSec);
  }
  /** 連続 BGM をデコードして設定(再生は play() 時、または playBgm())。 */
  async setBgm(source: SeamlessFragmentSource, opts?: { loop?: boolean; volume?: number }): Promise<void> {
    await this.audioReel.setBgm(source, opts);
  }
  async playBgm(): Promise<void> {
    await this.audioReel.playBgm();
  }
  stopBgm(): void {
    this.audioReel.stopBgm();
  }
  setBgmVolume(v: number): void {
    this.audioReel.setBgmVolume(v);
  }
  fadeBgm(target: number, durationSec: number): void {
    this.audioReel.fadeBgm(target, durationSec);
  }

  /** 指定フラグメントの先頭へシークする(音声尺ベース。算出不能時は何もしない)。 */
  seekToFragment(index: number): void {
    const offset = this.hasAudio ? this.audioReel.fragmentOffset(index) : null;
    if (offset == null) {
      this.log("seekToFragment: フラグメント開始位置が算出できませんでした(音声未デコード/映像のみ)");
      return;
    }
    this.video.currentTime = offset;
  }

  // --- 再生ライフサイクル(video イベント) ---

  private attachLifecycle(): void {
    if (this.lifecycleAttached) return;
    this.video.addEventListener("play", this.onVideoPlay);
    this.video.addEventListener("pause", this.onVideoPause);
    this.video.addEventListener("ended", this.onVideoEnded);
    this.lifecycleAttached = true;
  }

  private detachLifecycle(): void {
    if (!this.lifecycleAttached) return;
    this.video.removeEventListener("play", this.onVideoPlay);
    this.video.removeEventListener("pause", this.onVideoPause);
    this.video.removeEventListener("ended", this.onVideoEnded);
    this.lifecycleAttached = false;
  }

  private onVideoPlay = (): void => {
    this.options.onPlay?.();
  };
  private onVideoPause = (): void => {
    // ended に伴う pause では onPause を出さない(ended 側で扱う)
    if (!this.video.ended) this.options.onPause?.();
  };
  private onVideoEnded = (): void => {
    if (this.options.loop) {
      this.video.currentTime = 0;
      void this.video.play();
      return;
    }
    this.options.onEnded?.();
  };

  // --- progressive 読み込み ---

  private runProgressive(videos: SeamlessFragmentSource[], audios: SeamlessFragmentSource[]): void {
    // 映像: 並列フェッチ → 順序を保って append
    const vBufs = videos.map((v) => toArrayBuffer(v, this.options.fetcher));
    vBufs.forEach((p) => void p.catch(() => {}));

    void (async () => {
      try {
        for (let i = 0; i < videos.length; i++) {
          if (this.destroyed) return;
          const buf = await vBufs[i];
          await this.videoSource.append(buf);
          this.videoLoaded = i + 1;
          this.maybePlayable();
          this.emitState();
        }
        // open のときは確定しない(後から appendFragment 可能)。endReel() で確定する。
        if (!this.destroyed && !this.open) await this.videoSource.end();
      } catch (e) {
        this.options.onError?.(e instanceof Error ? e : new Error("映像の読み込みに失敗しました"));
      }
      this.checkComplete();
    })();

    // 音声: 並列デコード → 到着順に setBuffer(自動で追従スケジュール)
    audios.forEach((a, i) => {
      this.audioReel
        .decodeInto(i, a)
        .then(() => {
          if (this.destroyed) return;
          this.audioLoaded += 1;
          this.maybePlayable();
          this.emitState();
          this.checkComplete();
        })
        .catch((e: unknown) => {
          this.options.onError?.(e instanceof Error ? e : new Error("音声の読み込みに失敗しました"));
        });
    });
  }

  /** 先頭フラグメント(映像[0] と、音声があれば音声[0])が揃ったら playable に。 */
  private maybePlayable(): void {
    if (this.playable) return;
    const videoReady = this.videoLoaded >= 1;
    const audioReady = !this.hasAudio || this.audioReel.hasBuffer(0);
    if (videoReady && audioReady) {
      this.playable = true;
      this.log(`progressive: 再生可能 (ctx=${this.audioReel.contextState})`);
      this.playableResolve?.();
      this.playableResolve = null;
      this.emitState();
    }
  }

  private checkComplete(): void {
    if (this.complete || this.destroyed || this.open) return;
    const videoDone = this.videoLoaded >= this.total;
    const audioDone = !this.hasAudio || this.audioLoaded >= this.total;
    if (videoDone && audioDone) {
      this.complete = true;
      this.log("progressive: 全フラグメント読み込み完了");
      this.emitState();
    }
  }

  // --- リコンサイル(状態追従)ループ ---

  private startReconcileLoop(): void {
    this.stopReconcileLoop();
    const soft = this.options.syncThreshold ?? 0.08;
    const hard = this.options.hardResyncThreshold ?? 0.5;
    const interval = this.options.syncIntervalMs ?? 100;

    const tick = () => {
      if (this.destroyed) return;
      if (this.hasAudio) this.reconcileAudio(soft, hard);
      this.emitState();
      this.reconcileTimer = setTimeout(tick, interval);
    };
    this.reconcileTimer = setTimeout(tick, interval);
  }

  private stopReconcileLoop(): void {
    if (this.reconcileTimer != null) {
      clearTimeout(this.reconcileTimer);
      this.reconcileTimer = null;
    }
  }

  /** video の実状態に音声を合わせる(イベントのエッジには反応しない)。 */
  private reconcileAudio(soft: number, hard: number): void {
    const v = this.video;

    const blocked = v.paused || v.ended || v.seeking;
    if (blocked) {
      if (this.audioReel.isPlaying) {
        this.audioReel.stop();
        this.log("音声停止 (video 停止/シーク中)");
      }
      this.video.playbackRate = 1;
      return;
    }

    // 再生中なのに音声が鳴っていない: 現在位置から開始(デコード済みの残尺がある場合)
    if (!this.audioReel.isPlaying) {
      if (!this.audioStarting && v.currentTime < this.audioReel.duration - 0.05) {
        this.audioStarting = true;
        this.audioReel
          .start(v.currentTime)
          .then(() => {
            this.log(
              `音声開始 (ctx=${this.audioReel.contextState}, nodes=${this.audioReel.scheduledCount}, at=${v.currentTime.toFixed(2)}s)`,
            );
          })
          .catch((e: unknown) => {
            this.options.onError?.(e instanceof Error ? e : new Error("音声開始に失敗しました"));
          })
          .finally(() => {
            this.audioStarting = false;
          });
      }
      return;
    }

    // 映像・音声とも再生中: ドリフト補正(音声マスター、映像速度を微調整)
    const drift = v.currentTime - this.audioReel.currentTime();
    const abs = Math.abs(drift);
    let corrected = false;
    if (abs > hard) {
      void this.audioReel.start(v.currentTime);
      this.video.playbackRate = 1;
      corrected = true;
    } else if (abs > soft) {
      this.video.playbackRate = drift > 0 ? 0.97 : 1.03;
      corrected = true;
    } else {
      this.video.playbackRate = 1;
    }
    this.options.onDrift?.(drift, corrected);
  }

  private emitState(): void {
    const onState = this.options.onState;
    if (!onState) return;
    const v = this.video;
    let bufferedEnd = 0;
    try {
      if (v.buffered.length > 0) bufferedEnd = v.buffered.end(v.buffered.length - 1);
    } catch {
      /* buffered 取得不可は無視 */
    }
    const currentFragment = this.hasAudio ? this.audioReel.fragmentIndexAt(this.audioReel.currentTime()) : -1;
    const state: SeamlessReelState = {
      playable: this.playable,
      complete: this.complete,
      loadedVideo: this.videoLoaded,
      loadedAudio: this.audioLoaded,
      total: this.total,
      bufferedSec: Math.max(0, bufferedEnd - v.currentTime),
      currentFragment,
    };

    // 変化が無い(または僅少)なら通知しない。アイドル/一時停止中の無駄な再レンダーを防ぐ
    const prev = this.lastEmit;
    if (
      prev &&
      prev.playable === state.playable &&
      prev.complete === state.complete &&
      prev.loadedVideo === state.loadedVideo &&
      prev.loadedAudio === state.loadedAudio &&
      prev.total === state.total &&
      prev.currentFragment === state.currentFragment &&
      Math.abs(prev.bufferedSec - state.bufferedSec) < 0.25
    ) {
      return;
    }
    this.lastEmit = state;
    onState(state);
  }

  private log(message: string): void {
    this.options.onLog?.(message);
  }
}
