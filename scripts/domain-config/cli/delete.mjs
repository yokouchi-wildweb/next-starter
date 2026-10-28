// dc:delete <Domain>: 主と従属の組を壊す削除なら止める → 名前の再入力で確認 → 追加で消すディレクトリ → domain.json を残すか → 一覧確認 → 削除とレジストリの掃除

import fs from "node:fs";
import path from "node:path";
import { deleteStopMessage, findExtraDirs, listDeletePaths, removeDomainFiles, resolveAdminDir, resolveDeleteTarget } from "../pipeline/remove/index.mjs";
import { confirm, prompt } from "./prompts.mjs";

/**
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {string} domain
 */
export async function runDelete(workspace, domain) {
  const target = resolveDeleteTarget(workspace, domain);
  // 主と従属の組を壊す削除は、何も聞かずに止める（何も消さない）
  const stop = deleteStopMessage(workspace, path.basename(target.featureDir));
  if (stop) {
    console.error(stop);
    process.exitCode = 1;
    return;
  }

  const { confirm: typed } = await prompt({
    type: "input",
    name: "confirm",
    message: "削除確認のため同じドメイン名（snake_case）を入力してください:",
  });
  if (typed.trim() !== target.normalizedSnake) {
    console.log("ドメイン名が一致しないため中止しました。");
    return;
  }

  const { adminDir, pluralKebab } = resolveAdminDir(workspace, target);
  const searchDirs = findExtraDirs(workspace, target, adminDir);
  let extras = [];
  if (searchDirs.length > 0) {
    ({ extras } = await prompt({
      type: "checkbox",
      name: "extras",
      message: "追加で削除するディレクトリを選択:",
      choices: searchDirs.map((p) => ({ name: path.relative(workspace.rootDir, p), value: p })),
    }));
  }

  let removeConfig = true;
  if (fs.existsSync(target.configPath)) {
    removeConfig = await confirm("domain.json も削除しますか?", false);
  }

  console.log("以下を削除します:");
  listDeletePaths(workspace, { featureDir: target.featureDir, adminDir, extras }).forEach((p) => console.log(` - ${p}`));

  if (!(await confirm("削除を実行しますか?", false))) {
    console.log("削除をキャンセルしました。");
    return;
  }

  const failures = removeDomainFiles(workspace, { target, adminDir, pluralKebab, extras, removeConfig });
  if (failures.length > 0) {
    console.error("以下のレジストリは自動で更新できませんでした。手で該当エントリを削除してください:");
    failures.forEach((f) => console.error(` - ${f}`));
    process.exitCode = 1;
    return;
  }
  console.log("削除が完了しました。");
}
