#!/usr/bin/env node
// scripts/structure/role/toggleRole.mjs
// ロールのenable状態を切り替えるスクリプト
// 使い方: pnpm role:toggle <roleId> --on|--off [-i]（既定は対話なし。--on / --off のどちらか 1 つが必須 = 何度回しても同じ結果。
// -i のときだけ今までの対話（ロールの選択・反転の確認））

import fs from "fs";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import formatDomainConfig from "../../domain-config/spec/format.mjs";
import { failUsage, parseRoleOpsArgs } from "./cliArgs.mjs";
import { overrideFileName, readRoleOverride, requireOverride } from "./overrides.mjs";
import { findRoleFile, isCoreRole, listRoleFiles } from "./rolePaths.mjs";

const USAGE = "pnpm role:toggle <roleId> --on|--off [-i]";

const prompt = inquirer.createPromptModule();

/**
 * ロール一覧を取得（コアロール除外）
 */
function getToggleableRoles() {
  return listRoleFiles()
    .filter((file) => !file.isCore) // コアロールを除外
    .map((file) => ({ ...JSON.parse(fs.readFileSync(file.filePath, "utf-8")), filePath: file.filePath }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * 指定したロールのenabled状態を切り替え
 * @param {string} roleId - ロールID
 * @param {boolean|undefined} newState - 新しい状態（undefined の場合はトグル）
 */
function toggleRoleEnabled(roleId, newState) {
  const roles = getToggleableRoles();
  const role = roles.find((r) => r.id === roleId);

  if (!role) {
    // コアロールかどうかを確認
    if (isCoreRole(roleId)) {
      console.error(`エラー: コアロール「${roleId}」は切り替えできません。`);
    } else {
      console.error(`エラー: ロール「${roleId}」が見つかりません。`);
    }
    process.exit(1);
  }

  // 上書きが enabled を決めているロールは JSON を書いても効かないので止める
  const roleFile = findRoleFile(roleId);
  if (requireOverride(readRoleOverride(roleFile)).enabled !== undefined) {
    console.error(`エラー: ロール「${roleId}」の enabled は ${overrideFileName(roleFile.fileName)} が決めています。そのファイルを直してから pnpm role:generate を実行してください。`);
    process.exit(1);
  }

  const currentState = role.enabled ?? true;
  const targetState = newState !== undefined ? newState : !currentState;

  if (currentState === targetState) {
    console.log(
      `ロール「${role.label}」は既に ${targetState ? "有効" : "無効"} です。`
    );
    return;
  }

  // 設定を更新
  const updatedConfig = {
    ...role,
    enabled: targetState,
  };
  delete updatedConfig.filePath;

  fs.writeFileSync(role.filePath, formatDomainConfig(updatedConfig));
  console.log(
    `ロール「${role.label}」を ${targetState ? "有効" : "無効"} にしました。`
  );
}

/**
 * 対話形式でロールを選択して切り替え
 */
async function interactiveToggle() {
  const roles = getToggleableRoles();

  if (roles.length === 0) {
    console.log("切り替え可能なロールが見つかりません。");
    console.log("（コアロールは切り替え対象外です）");
    process.exit(0);
  }

  // ロール選択
  const choices = roles.map((role) => ({
    name: `${role.label} (${role.id}) - 現在: ${role.enabled !== false ? "有効" : "無効"}`,
    value: role.id,
  }));

  const { roleId } = await prompt({
    type: "list",
    name: "roleId",
    message: "切り替えるロールを選択:",
    choices,
  });

  const role = roles.find((r) => r.id === roleId);
  const currentState = role.enabled !== false;

  // 切り替え確認
  const { action } = await prompt({
    type: "list",
    name: "action",
    message: `「${role.label}」をどうしますか？`,
    choices: [
      {
        name: currentState ? "無効にする" : "有効にする",
        value: "toggle",
      },
      { name: "キャンセル", value: "cancel" },
    ],
  });

  if (action === "cancel") {
    console.log("キャンセルしました。");
    return;
  }

  toggleRoleEnabled(roleId);
}

/**
 * メイン処理
 * @param {string|undefined} roleId - ロールID
 * @param {Object} options - オプション
 * @param {boolean} options.on - 有効にする
 * @param {boolean} options.off - 無効にする
 * @param {boolean} options.interactive - 対話（ロールの選択・反転）。無ければ roleId と --on|--off が必須
 */
export default async function toggle(roleId, options = {}) {
  console.log("\n=== ロールの有効/無効切り替え ===\n");

  if (options.interactive && !roleId) {
    await interactiveToggle();
    return;
  }

  // on/off オプションが両方指定されている場合はエラー
  if (options.on && options.off) {
    failUsage("--on と --off を同時に指定できません", USAGE);
    return;
  }
  if (!roleId) {
    failUsage("ロール ID を指定してください（選んで切り替えるなら -i）", USAGE);
    return;
  }
  // 反転（--on / --off なし）は -i のときだけ（何度回しても同じ結果にするため）
  if (!options.on && !options.off && !options.interactive) {
    failUsage("--on か --off を指定してください（反転するなら -i）", USAGE);
    return;
  }

  const newState = options.on ? true : options.off ? false : undefined;
  toggleRoleEnabled(roleId, newState);
}

// 直接実行された場合
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { positional, interactive, flags } = parseRoleOpsArgs(process.argv.slice(2), { flags: ["on", "off"] });
    toggle(positional, { on: flags.has("on"), off: flags.has("off"), interactive }).catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
  } catch (err) {
    failUsage(err.message, USAGE);
  }
}
