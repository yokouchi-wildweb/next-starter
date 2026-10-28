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
   * - reconcile: 紐付け先の行が消えた台帳行の照合（DB の cascade 等でアプリを通らずに消えた行の片付け）
   *   - maxDetachPerRun: 1 回の実行で片付けてよい行数の上限。達したら照合を止めて警告する
   *   - massMissingMin: 1 つの束で同じ record_type の ID がこの数以上あって 1 件も見つからなければ、
   *     表の取り違え・誤った全消去を疑い、その record_type は消さずに警告する
   *   - valueCheck: 行はあるが、紐付け先の列の値にもう入っていない台帳行（列の削除・生 SQL や移行での書き換え）の扱い
   *     - "off" = 見ない | "report" = 件数と表・列を結果と警告に出すだけで消さない | "detach" = 外して実物を消す（reason unreferenced）
   *     - 報告を確かめてから "detach" にする（コードを先にデプロイして db:push が後の間は、DB に残る列も「無い」と見える）
   *     - 値の検査にも massMissingMin を使う: 列はあるのに 1 つの束でこの数以上の値が 1 件も入っていなければ、
   *       読み出しの取り違えを疑い、その列は消さずに警告する（列そのものが無い場合は使わない）
   */
  sweep: {
    budgetMs: 45_000,
    chunkSize: 100,
    reconcile: {
      maxDetachPerRun: 1000,
      massMissingMin: 50,
      valueCheck: "report" as "off" | "report" | "detach",
    },
  },

  /**
   * metadata: "strip" の用途で、commit 時にサーバーが画像を描き直すときの上限と品質（src/lib/storage/server/imageStrip.ts）。
   * - maxFramePixels: 1 フレームの画素数の上限（幅 × 高さ）。超えたら 422
   * - maxTotalPixels: 全フレームの画素数の合計の上限（アニメーション GIF / WebP）。超えたら 422
   * - quality: 出力の品質（1〜100）。png / gif は sharp の既定。縮小はしない
   */
  imageStrip: {
    maxFramePixels: 100_000_000,
    maxTotalPixels: 100_000_000,
    quality: {
      jpeg: 90,
      webp: 90,
      avif: 60,
    },
  },
} as const;

export type StorageConfig = typeof STORAGE_CONFIG;
