#!/usr/bin/env node
// scripts/role-config/toggleRole.mjs
// ロールのenable状態を切り替えるスクリプト

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import formatDomainConfig from "../domain-config/utils/formatConfig.mjs";

const prompt = inquirer.createPromptModule();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const ROLES_DIR = path.join(ROOT_DIR, "src/features/core/user/roles");

/**
 * ロール一覧を取得（コアロール除外）
 */
function getToggleableRoles() {
  if (!fs.existsSync(ROLES_DIR)) {
    return [];
  }

  const files = fs.readdirSync(ROLES_DIR);
  return files
    .filter((file) => file.endsWith(".role.json"))
    .map((file) => {
      const filePath = path.join(ROLES_DIR, file);
      const config = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return {
        ...config,
        filePath,
        isCore: file.startsWith("_") || config.isCore,
      };
    })
    .filter((role) => !role.isCore) // コアロールを除外
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
    const allFiles = fs.readdirSync(ROLES_DIR);
    const coreFile = allFiles.find(
      (f) => f === `_${roleId}.role.json` || f === `${roleId}.role.json`
    );
    if (coreFile && coreFile.startsWith("_")) {
      console.error(`エラー: コアロール「${roleId}」は切り替えできません。`);
    } else {
      console.error(`エラー: ロール「${roleId}」が見つかりません。`);
    }
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
  delete updatedConfig.isCore;

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
 * @param {string|undefined} roleId - ロールID（undefined の場合は対話形式）
 * @param {Object} options - オプション
 * @param {boolean} options.on - 有効にする
 * @param {boolean} options.off - 無効にする
 */
export default async function toggle(roleId, options = {}) {
  console.log("\n=== ロールの有効/無効切り替え ===\n");

  if (!roleId) {
    await interactiveToggle();
    return;
  }

  // on/off オプションが両方指定されている場合はエラー
  if (options.on && options.off) {
    console.error("エラー: --on と --off を同時に指定できません。");
    process.exit(1);
  }

  const newState = options.on ? true : options.off ? false : undefined;
  toggleRoleEnabled(roleId, newState);
}

// 直接実行された場合
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const roleId = args.find((arg) => !arg.startsWith("--"));
  const options = {
    on: args.includes("--on"),
    off: args.includes("--off"),
  };

  toggle(roleId, options).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
