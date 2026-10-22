// src/config/app/storage.config.ts

/**
 * Storage（ファイル保存）の運用値。
 *
 * 判定・処理のロジックは src/lib/storage と features/core/storageObject が持ち、ここは値だけを置く。
 * 下流プロジェクトは値を調整してよい（キーの追加・削除・型の変更は upstream の承認が要る）。
 * 仕組みの説明: src/lib/storage/README.md
 */

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

export const STORAGE_CONFIG = {
  /**
   * 非公開ファイルの読み取り用署名 URL の有効期間（秒）。
   * GET /api/storage/objects/[id] が都度認可したうえで、この期間の署名 URL へ 302 する。
   * - image / file: 画像・一般ファイル
   * - video / audio: 動画・音声（シークで再取得が起きるため長め）
   * - probe: サーバーでのメディア解析（mediaProbe）用
   */
  readTtlSec: {
    image: 300,
    file: 300,
    video: 900,
    audio: 900,
    probe: 120,
  },

  /**
   * アップロード権の発行期限（秒）。
   * - put: 単発 PUT の署名 URL（15 分）
   * - session: GCS の再開可能セッション（24 時間。GCS 側のセッション URI 自体は約 1 週間生きるため、
   *   台帳はこの期限で受付を締め、中止・期限切れではサーバーがセッション URI を DELETE する）
   */
  issueTtlSec: {
    put: 15 * 60,
    session: 24 * 60 * 60,
  },

  /** commit 済み（ready）だが業務行に紐付かないファイルを掃除するまでの猶予（秒） */
  unattachedGraceSec: 24 * 60 * 60,

  /** 用途に maxPending が無いときの、1 ユーザーあたりの未完了アップロード数の上限 */
  defaultMaxPending: 20,

  /** このサイズ（バイト）を超えるファイルは単発 PUT ではなく再開可能セッションで送る */
  sessionThresholdBytes: 16 * MiB,

  /**
   * domain.json のメディア項目に validationRule.maxSizeBytes が無いときに使う上限（バイト）。
   * キーは mediaTypePreset。dc:generate がこの値を用途に入れ、警告を出す。
   */
  defaultMaxBytesByPreset: {
    images: 20 * MiB,
    videos: 2 * GiB,
    imagesAndVideos: 2 * GiB,
    all: 2 * GiB,
  },

  /**
   * 掃除 cron（storage-sweep）の時間予算。
   * - budgetMs: 1 回の実行で使う時間（createDeadline に渡す）
   * - chunkSize: 1 チャンクで扱う台帳の行数
   */
  sweep: {
    budgetMs: 45_000,
    chunkSize: 100,
  },
} as const;

export type StorageConfig = typeof STORAGE_CONFIG;
