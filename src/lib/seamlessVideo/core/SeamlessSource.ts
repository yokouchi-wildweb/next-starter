// src/lib/seamlessVideo/core/SeamlessSource.ts
//
// 複数の fmp4 フラグメントを MSE で 1 本の映像として継ぎ目なく連結再生するコア。
// フレームワーク非依存(React 等に依存しない)。HTMLVideoElement を受け取り制御する。
//
// 連結の要点:
//   - SourceBuffer.mode = "sequence" を使い、各フラグメント内部のタイムスタンプ(各々 0 始まり)を
//     直前メディアの末尾に自動連結する。これが「独立エンコードされた動画を任意順で繋ぐ」前提。
//   - 各フラグメントは単体完結の fmp4(ftyp+moov+moof+mdat)を想定。各々が自分の init を持つため、
//     同一コーデックなら順次 append でき、コーデックが変わる場合のみ changeType で切り替える。
//   - iPhone Safari は ManagedMediaSource を使用(codecSupport で透過解決)。

import type { FragmentFetcher, SeamlessFragmentSource } from "../types";
import { getMediaSourceCtor, isManagedMediaSource, isTypeSupported } from "./codecSupport";
import { toArrayBuffer } from "./fragmentBytes";
import { parseFragmentSafe } from "../probe/boxWalker";

export type SeamlessSourceOptions = {
  /** 連結に使う MIME。省略時は先頭フラグメントから自動推定する。例: 'video/mp4; codecs="avc1.640028"' */
  mimeType?: string;
  /** URL ソースのバイト取得を差し替える(認証/キャッシュ/CDN 等)。省略時は標準 fetch */
  fetcher?: FragmentFetcher;
  /** 1 フラグメント append 完了ごとに通知(appended は累積、total は判明していれば総数) */
  onFragmentAppended?: (appended: number, total: number) => void;
  /** エラー通知 */
  onError?: (error: Error) => void;
  /** デバッグ用ログ */
  onLog?: (message: string) => void;
};

export class SeamlessSource {
  private readonly video: HTMLVideoElement;
  private readonly options: SeamlessSourceOptions;
  private readonly msCtor = getMediaSourceCtor();

  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private objectUrl: string | null = null;
  private currentMime: string | null = null;

  /** append を直列化するためのプロミスチェーン(appendBuffer は非同期で同時実行不可) */
  private appendChain: Promise<void> = Promise.resolve();
  private appendedCount = 0;
  private plannedTotal = 0;
  private destroyed = false;

  constructor(video: HTMLVideoElement, options: SeamlessSourceOptions = {}) {
    this.video = video;
    this.options = options;
  }

  /**
   * プレイリスト全体を読み込み、全フラグメントを連結して endOfStream するまで待つ。
   * 全ソースのバイト取得は並列で開始し、append のみ順序を保って直列に行う(ダウンロード律速を短縮)。
   */
  async load(sources: SeamlessFragmentSource[], finalize = true): Promise<void> {
    if (!this.msCtor) throw new Error("この環境は MSE(MediaSource)に対応していません");
    this.plannedTotal = sources.length;
    await this.attach();

    // 取得は並列に開始(順序維持は append 側で行う)
    const pending = sources.map((s) => toArrayBuffer(s, this.options.fetcher));
    // 途中で throw して未 await の取得が残っても unhandledRejection にしない
    pending.forEach((p) => void p.catch(() => {}));

    for (let i = 0; i < sources.length; i++) {
      if (this.destroyed) return;
      const buffer = await pending[i];
      await this.ensureSourceBuffer(buffer);
      // 2 本目以降はコーデックが変わったときのみ changeType するため MIME を推定
      const mime = i === 0 ? undefined : parseFragmentSafe(buffer)?.mimeType ?? undefined;
      await this.enqueueAppend(buffer, mime);
      this.appendedCount += 1;
      this.options.onFragmentAppended?.(this.appendedCount, this.plannedTotal);
    }

    // finalize=false の場合は endOfStream せず、以後の append を許可する(動的シーケンス用)
    if (finalize) await this.endOfStream();
  }

  /** 実行時に 1 フラグメントを末尾へ追加する(抽選など順序・本数が動的に決まるユースケース向け)。 */
  async append(source: SeamlessFragmentSource): Promise<void> {
    if (!this.msCtor) throw new Error("この環境は MSE(MediaSource)に対応していません");
    await this.attach();
    const buffer = await toArrayBuffer(source, this.options.fetcher);
    await this.ensureSourceBuffer(buffer);
    const mime = this.sourceBuffer ? parseFragmentSafe(buffer)?.mimeType ?? undefined : undefined;
    await this.enqueueAppend(buffer, this.appendedCount === 0 ? undefined : mime);
    this.appendedCount += 1;
    this.plannedTotal = Math.max(this.plannedTotal, this.appendedCount);
    this.options.onFragmentAppended?.(this.appendedCount, this.plannedTotal);
  }

  /** これ以上フラグメントを追加しないことを宣言する(動的 append 後の明示終了用)。 */
  async end(): Promise<void> {
    await this.appendChain;
    await this.endOfStream();
  }

  /** リソースを破棄し、video から切り離す。 */
  destroy(): void {
    this.destroyed = true;
    try {
      if (this.mediaSource && this.mediaSource.readyState === "open") {
        this.mediaSource.endOfStream();
      }
    } catch {
      /* noop */
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    try {
      this.video.removeAttribute("src");
      // srcObject 経由(ManagedMediaSource)の場合の解除
      (this.video as unknown as { srcObject: MediaSource | null }).srcObject = null;
      this.video.load();
    } catch {
      /* noop */
    }
    this.sourceBuffer = null;
    this.mediaSource = null;
  }

  // --- 内部実装 ---

  /** MediaSource を生成し video に接続、sourceopen を待つ。 */
  private attach(): Promise<void> {
    if (this.mediaSource) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const Ctor = this.msCtor;
      if (!Ctor) {
        reject(new Error("この環境は MSE(MediaSource)に対応していません"));
        return;
      }
      const ms = new Ctor();
      this.mediaSource = ms;

      const onOpen = () => {
        ms.removeEventListener("sourceopen", onOpen);
        this.log("sourceopen");
        resolve();
      };
      ms.addEventListener("sourceopen", onOpen);

      if (isManagedMediaSource(Ctor)) {
        // iPhone: リモート再生を抑止し、srcObject 接続を優先(失敗時は object URL にフォールバック)
        try {
          (this.video as unknown as { disableRemotePlayback: boolean }).disableRemotePlayback = true;
        } catch {
          /* noop */
        }
        try {
          (this.video as unknown as { srcObject: MediaSource }).srcObject = ms;
        } catch {
          this.objectUrl = URL.createObjectURL(ms);
          this.video.src = this.objectUrl;
        }
      } else {
        this.objectUrl = URL.createObjectURL(ms);
        this.video.src = this.objectUrl;
      }
    });
  }

  /** 初回フラグメントから SourceBuffer を生成(sequence モード)。 */
  private async ensureSourceBuffer(firstBuffer: ArrayBuffer): Promise<void> {
    if (this.sourceBuffer || !this.mediaSource) return;

    let mime = this.options.mimeType;
    if (!mime) {
      mime = parseFragmentSafe(firstBuffer)?.mimeType ?? undefined;
    }
    if (!mime) {
      throw new Error("フラグメントからコーデックを判定できませんでした。mimeType を明示してください");
    }
    if (!isTypeSupported(mime)) {
      throw new Error(`この環境では未対応のコーデックです: ${mime}`);
    }

    const sb = this.mediaSource.addSourceBuffer(mime);
    // 各フラグメント内部の時刻(0 始まり)を直前メディア末尾へ自動連結する
    sb.mode = "sequence";
    this.sourceBuffer = sb;
    this.currentMime = mime;
    this.log(`SourceBuffer 生成: ${mime}`);
  }

  /** append をチェーンに積み、直列に実行する。 */
  private enqueueAppend(data: ArrayBuffer, mime?: string): Promise<void> {
    this.appendChain = this.appendChain.then(() => this.doAppend(data, mime));
    return this.appendChain;
  }

  private doAppend(data: ArrayBuffer, mime?: string): Promise<void> {
    return this.appendOnce(data, mime, true);
  }

  /** 1 回 append する。QuotaExceededError 時は再生済み区間を退避して 1 度だけ再試行する。 */
  private appendOnce(data: ArrayBuffer, mime: string | undefined, allowEvict: boolean): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const sb = this.sourceBuffer;
      if (!sb || this.destroyed) {
        resolve();
        return;
      }

      const cleanup = () => {
        sb.removeEventListener("updateend", onUpdateEnd);
        sb.removeEventListener("error", onError);
      };
      const onUpdateEnd = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        const err = new Error("SourceBuffer への append に失敗しました");
        this.options.onError?.(err);
        reject(err);
      };
      sb.addEventListener("updateend", onUpdateEnd);
      sb.addEventListener("error", onError);

      try {
        // コーデックが変わる場合のみ changeType(各フラグメントは自分の init を含む前提)
        if (mime && mime !== this.currentMime && typeof sb.changeType === "function") {
          sb.changeType(mime);
          this.currentMime = mime;
          this.log(`changeType: ${mime}`);
        }
        sb.appendBuffer(data);
      } catch (e) {
        cleanup();
        // バッファ満杯: 再生済み区間を退避して 1 度だけ再試行
        if (allowEvict && e instanceof DOMException && e.name === "QuotaExceededError") {
          this.log("QuotaExceeded: 再生済み区間を退避して再試行");
          this.removeRange(Math.max(0, this.video.currentTime - 2))
            .then(() => this.appendOnce(data, mime, false))
            .then(resolve, reject);
          return;
        }
        const err = e instanceof Error ? e : new Error("appendBuffer に失敗しました");
        this.options.onError?.(err);
        reject(err);
      }
    });
  }

  /** buffered の先頭から removeEnd までを削除する(SourceBuffer が更新中でなければ実行)。 */
  private removeRange(removeEnd: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const sb = this.sourceBuffer;
      if (!sb || this.destroyed || sb.updating || sb.buffered.length === 0 || removeEnd <= 0) {
        resolve();
        return;
      }
      const start = sb.buffered.start(0);
      if (removeEnd <= start) {
        resolve();
        return;
      }
      const onUpdateEnd = () => {
        sb.removeEventListener("updateend", onUpdateEnd);
        resolve();
      };
      sb.addEventListener("updateend", onUpdateEnd);
      try {
        sb.remove(start, removeEnd);
      } catch {
        sb.removeEventListener("updateend", onUpdateEnd);
        resolve();
      }
    });
  }

  /** 再生位置より keepSec 以上前の区間を退避する(長尺 open ストリームのメモリ抑制)。append と直列化。 */
  evictBehind(keepSec: number): Promise<void> {
    this.appendChain = this.appendChain.then(() =>
      this.removeRange(Math.max(0, this.video.currentTime - keepSec)),
    );
    return this.appendChain;
  }

  private async endOfStream(): Promise<void> {
    await this.appendChain;
    if (this.destroyed) return;
    const ms = this.mediaSource;
    if (ms && ms.readyState === "open") {
      try {
        ms.endOfStream();
        this.log("endOfStream");
      } catch (e) {
        this.options.onError?.(e instanceof Error ? e : new Error("endOfStream に失敗しました"));
      }
    }
  }

  private log(message: string): void {
    this.options.onLog?.(message);
  }
}
