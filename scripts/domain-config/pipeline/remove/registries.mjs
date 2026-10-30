// dc:delete の後始末: serviceRegistry.ts の作り直しだけ（他の src/registry の一覧は pnpm registry:generate が走査で作る）。
// 失敗してもディレクトリ削除は済んでいるため止めず、failures に積んで最後に手で直す案内を出す

import { regenerateServiceRegistry } from "../serviceRegistry.mjs";

/**
 * @returns {string[]} 自動で直せなかったレジストリ（手で直す案内）
 */
export function cleanupRegistries(workspace, io) {
  const failures = [];
  // serviceRegistry.ts は domainEntry.ts（ドメインのフォルダごと消えた）から丸ごと作り直す
  try {
    regenerateServiceRegistry(workspace);
  } catch (err) {
    failures.push(`src/registry/serviceRegistry.ts: 再生成できませんでした（${err.message}）`);
  }
  io.log("src/registry の一覧は pnpm registry:generate で作り直してください");
  return failures;
}
