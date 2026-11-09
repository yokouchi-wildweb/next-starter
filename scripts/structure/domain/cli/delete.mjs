// pnpm generate domain -- --delete <Domain>: 組を壊す削除・他のドメインから参照されているドメインの削除なら止める → 確認 → 削除とレジストリの掃除。
// 既定は対話なし: --confirm <snake_name> が一致したときだけ消す（名前の打ち直しの安全装置を引数にしたもの）。
// 追加で消すディレクトリは --extra <path>（findExtraDirs の候補だけ、何度でも）、domain.json は --remove-config のときだけ消す。
// -i（--interactive）のときだけ今までの対話（名前の再入力 → 追加ディレクトリの選択 → domain.json を消すか → 確認）

import fs from "node:fs";
import path from "node:path";
import { codeReferenceStopMessage, deleteStopMessage, findExtraDirs, gateRuleStopMessage, listDeletePaths, removeDomainFiles, resolveAdminDir, resolveDeleteTarget } from "../pipeline/remove/index.mjs";
import { refreshDistrictMap } from "../pipeline/generate.mjs";
import { confirm, prompt } from "./prompts.mjs";

/** 対話で確認と追加の選択を聞く。中止なら null */
async function askInteractive(workspace, target, searchDirs) {
  const { confirm: typed } = await prompt({
    type: "input",
    name: "confirm",
    message: "削除確認のため同じドメイン名（snake_case）を入力してください:",
  });
  if (typed.trim() !== target.normalizedSnake) {
    console.log("ドメイン名が一致しないため中止しました。");
    return null;
  }
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
  return { extras, removeConfig };
}

/**
 * 引数の確認と追加ディレクトリを解く。足りなければ消すものの一覧とコマンド例を出して終了コード 1（null）
 * @param {{ confirm?: string, extras?: string[], removeConfig?: boolean }} options
 */
function resolveArguments(workspace, target, domain, searchDirs, listed, options) {
  const rel = (p) => path.relative(workspace.rootDir, p);
  const known = new Map(searchDirs.map((p) => [rel(p), p]));
  const unknown = (options.extras ?? []).filter((p) => !known.has(path.normalize(p)));
  if (unknown.length > 0) {
    console.error(`--extra に候補に無いディレクトリがあります: ${unknown.join(", ")}（候補: ${[...known.keys()].join(", ") || "なし"}）`);
    process.exitCode = 1;
    return null;
  }
  const extras = (options.extras ?? []).map((p) => known.get(path.normalize(p)));
  if (options.confirm !== target.normalizedSnake) {
    console.error(options.confirm === undefined ? "削除するには --confirm でドメイン名（snake_case）を渡してください。" : `--confirm "${options.confirm}" がドメイン名 "${target.normalizedSnake}" と一致しません。`);
    console.error("消すもの:");
    listed(extras).forEach((p) => console.error(` - ${p}`));
    if (searchDirs.length > 0) console.error(`追加で消せるディレクトリ（--extra <path>）: ${[...known.keys()].join(", ")}`);
    console.error(`実行: pnpm generate domain -- --delete ${domain} --confirm ${target.normalizedSnake}${options.removeConfig ? " --remove-config" : ""}（domain.json も消すなら --remove-config）`);
    process.exitCode = 1;
    return null;
  }
  return { extras, removeConfig: Boolean(options.removeConfig) };
}

/**
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {string} domain
 * @param {{ interactive?: boolean, confirm?: string, extras?: string[], removeConfig?: boolean }} [options]
 */
export async function runDelete(workspace, domain, options = {}) {
  const target = resolveDeleteTarget(workspace, domain);
  // 組を壊す削除・参照されているドメインの削除は、何も聞かずに止める（何も消さない）
  const { adminDir, pluralKebab } = resolveAdminDir(workspace, target);
  const searchDirs = findExtraDirs(workspace, target, adminDir);
  const withAdmin = (dirs) => [...(adminDir ? [adminDir] : []), ...dirs];
  // 消さずに残るコードからの import も止める。確認より前は追加ディレクトリの候補を全部除いて数え、選んだ後に選ばなかった候補を数える
  // 門番の規則がこのドメインを features に持てば止める(規則の features から先に外す。D26)
  const stop =
    gateRuleStopMessage(workspace, target.featureDir) ??
    deleteStopMessage(workspace, path.basename(target.featureDir)) ??
    codeReferenceStopMessage(workspace, target.featureDir, withAdmin(searchDirs));
  if (stop) {
    console.error(stop);
    process.exitCode = 1;
    return;
  }

  const listed = (extras) => listDeletePaths(workspace, { featureDir: target.featureDir, adminDir, extras });

  const chosen = options.interactive
    ? await askInteractive(workspace, target, searchDirs)
    : resolveArguments(workspace, target, domain, searchDirs, listed, options);
  if (!chosen) return;
  const { extras, removeConfig } = chosen;
  if (extras.length < searchDirs.length) {
    const unchosenStop = codeReferenceStopMessage(workspace, target.featureDir, withAdmin(extras));
    if (unchosenStop) {
      console.error(unchosenStop);
      process.exitCode = 1;
      return;
    }
  }

  console.log("以下を削除します:");
  listed(extras).forEach((p) => console.log(` - ${p}`));
  if (!removeConfig && fs.existsSync(target.configPath)) {
    console.log(`（domain.json は残します: ${path.relative(workspace.rootDir, target.configPath)}）`);
  }

  if (options.interactive && !(await confirm("削除を実行しますか?", false))) {
    console.log("削除をキャンセルしました。");
    return;
  }

  const failures = removeDomainFiles(workspace, { target, adminDir, pluralKebab, extras, removeConfig });
  // 地区の地図(district-map.jsonl)を今のフォルダに合わせる
  refreshDistrictMap(workspace);
  if (failures.length > 0) {
    console.error("以下のレジストリは自動で更新できませんでした。手で該当エントリを削除してください:");
    failures.forEach((f) => console.error(` - ${f}`));
    process.exitCode = 1;
    return;
  }
  console.log("削除が完了しました。");
}
