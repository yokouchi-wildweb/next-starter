// src/features/core/user/services/server/userService.ts

import { base } from "./drizzleBase";
import { checkAdminUserExists } from "./finders/checkAdminUserExists";
import { findByIdWithSecrets } from "./finders/findByIdWithSecrets";
import { findByLocalEmail } from "./finders/findByLocalEmail";
import { findByProvider } from "./finders/findByProvider";
import { findSignupSummariesByIds } from "./finders/findSignupSummariesByIds";
import {
  createAdmin,
  createGeneralUser,
  createDemoUser,
  createGuestDemoUser,
} from "./creation";
import { seedCreate } from "./creation/seedCreate";
import { registerFromAuth, preRegisterFromAuth, createFromProvider } from "./registration";
import { create } from "./wrappers/create";
import { hardDelete } from "./wrappers/hardDelete";
import { remove } from "./wrappers/remove";
import { restore } from "./wrappers/restore";
import { update, updateSelf } from "./wrappers/update";
import { updateLastAuthenticated } from "./wrappers/updateLastAuthenticated";
import { changeStatus } from "./wrappers/changeStatus";
import { bulkChangeStatus } from "./wrappers/bulkChangeStatus";
import { changeRole } from "./wrappers/changeRole";
import { softDelete } from "./wrappers/softDelete";
import { searchWithProfile } from "./wrappers/searchWithProfile";
import { bulkUpdate, bulkUpdateByIds } from "./wrappers/bulkUpdate";
import { checkLockState, recordFailedLogin, clearLockState } from "./wrappers/lockoutPolicy";

export { requireUserRecord } from "./resolvers/requireUserRecord";
export {
  formatShortLockMessage,
  PERMANENT_LOCK_MESSAGE,
  type LockState,
  type FailedLoginOutcome,
} from "./wrappers/lockoutPolicy";

// 行を作る一括書き込み・複製系は update ラッパー (表示名の一意性ガード / ステータス履歴 / Firebase 同期 /
// セッション失効) を通らないため公開しない。汎用 /api/user/** の該当ルートは 404、CSV インポートも拒否される。
// サービス内部で必要な場合は base を直接使う (例: registration/setPending.ts の base.upsert)。
// bulkUpdate / bulkUpdateByIds は副作用の無い列に限ったラッパーを公開する (wrappers/bulkUpdate.ts)。
// 一括削除も softDelete (ステータス変更 / クリーンアップ / 監査ログ) を通らないため公開しない (該当ルートは 404)。
// 条件での一括更新 bulkUpdateByQuery (列の制限なし) と物理の一括削除 bulkHardDeleteByIds も同じ理由で公開しない
// (汎用のデータ操作のコマンド pnpm ops data もサービスに無い操作はしない。src/lib/domain の resolveDataCommand)。
// systemBulkUpdateByQuery は許した systemColumns だけを書くサービス層の道具なので残す (HTTP・コマンドには出ない)。
const {
  upsert: _upsert,
  bulkUpsert: _bulkUpsert,
  replaceByQuery: _replaceByQuery,
  duplicate: _duplicate,
  bulkDeleteByIds: _bulkDeleteByIds,
  bulkDeleteByQuery: _bulkDeleteByQuery,
  bulkUpdateByQuery: _bulkUpdateByQuery,
  bulkHardDeleteByIds: _bulkHardDeleteByIds,
  ...exposedBase
} = base;

export const userService = {
  ...exposedBase,
  create,
  remove,
  hardDelete,
  restore,
  update,
  updateSelf,
  // finders
  findByProvider,
  findByLocalEmail,
  findByIdWithSecrets,
  checkAdminUserExists,
  findSignupSummariesByIds,
  // wrappers
  updateLastAuthenticated,
  changeStatus,
  /** ステータスの一括変更(1 人 1 transaction、dryRun あり。README「ステータスの一括変更」) */
  bulkChangeStatus,
  changeRole,
  softDelete,
  searchWithProfile,
  bulkUpdate,
  bulkUpdateByIds,
  // lockout policy
  checkLockState,
  recordFailedLogin,
  clearLockState,
  // creation (console)
  createAdmin,
  createGeneralUser,
  createDemoUser,
  createGuestDemoUser,
  // シード(pnpm ops db seed)の行を入れる入口: デモの利用者だけ
  seedCreate,
  // registration (auth)
  registerFromAuth,
  preRegisterFromAuth,
  // 新しい認証手段 (外部の身元 → 利用者。auth README「新しい認証手段」)
  createFromProvider,
};
