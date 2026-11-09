// src/features/core/storageObject/config.ts
// ファイルの台帳（storageObject）の運用値（既定 + 上書き）。上書きは src/config/features/storageObject.config.ts（このファイルだけが読む）。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。読み取り署名の TTL と strip の描き直しの値は src/config/app/storage.config.ts（lib/storage の側、まだ移していない）

import override from "@/config/features/storageObject.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

/** 照合の値の検査（sweep.reconcile.valueCheck）の扱い */
export type StorageValueCheckMode = "off" | "report" | "detach";

export type StorageObjectConfig = {
  issueTtlSec: { put: number; session: number };
  unattachedGraceSec: number;
  defaultMaxPending: number;
  sessionThresholdBytes: number;
  defaultMaxBytesByPreset: { images: number; videos: number; imagesAndVideos: number; all: number };
  sweep: {
    budgetMs: number;
    chunkSize: number;
    reconcile: { maxDetachPerRun: number; massMissingMin: number; valueCheck: StorageValueCheckMode };
  };
};

const defaults: StorageObjectConfig = {
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
   * キーは mediaTypePreset。pnpm generate domain がこの値を用途に入れ、警告を出す。
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
      valueCheck: "report",
    },
  },

};

export const storageObjectConfigDef = defineConfig(defaults, { label: "storageObject" });

/** 上書きのファイルの型（`export default { ... } satisfies StorageObjectOverride`） */
export type StorageObjectOverride<E extends object = Record<never, never>> = OverrideOf<typeof storageObjectConfigDef, E>;

/** 合成済みの設定（読み込み時に 1 回作る） */
export const storageObjectConfig: StorageObjectConfig = storageObjectConfigDef.compose(override);
