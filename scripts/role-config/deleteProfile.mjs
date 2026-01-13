#!/usr/bin/env node
// scripts/role-config/deleteProfile.mjs
// プロフィール関連のレジストリエントリを削除するスクリプト

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import { cleanupProfile } from "./generator/cleanupProfile.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const PROFILES_DIR = path.join(ROOT_DIR, "src/features/core/userProfile/profiles");
const ROLES_DIR = path.join(ROOT_DIR, "src/features/core/user/roles");

const prompt = inquirer.createPromptModule();

/**
 * プロフィール設定が存在するロールを取得
 */
function getRolesWithProfile() {
  if (!fs.existsSync(PROFILES_DIR)) {
    return [];
  }

  const profileFiles = fs.readdirSync(PROFILES_DIR);
  const roles = [];

  for (const file of profileFiles) {
    if (!file.endsWith(".profile.json")) continue;

    const roleId = file.replace(".profile.json", "");
    const profilePath = path.join(PROFILES_DIR, file);
    const profileConfig = JSON.parse(fs.readFileSync(profilePath, "utf-8"));

    // ロール設定も確認
    let roleLabel = roleId;
    let isCore = false;
    const rolePath = path.join(ROLES_DIR, `${roleId}.role.json`);
    const coreRolePath = path.join(ROLES_DIR, `_${roleId}.role.json`);

    if (fs.existsSync(rolePath)) {
      const roleConfig = JSON.parse(fs.readFileSync(rolePath, "utf-8"));
      roleLabel = roleConfig.label || roleId;
      isCore = roleConfig.isCore || false;
    } else if (fs.existsSync(coreRolePath)) {
      const roleConfig = JSON.parse(fs.readFileSync(coreRolePath, "utf-8"));
      roleLabel = roleConfig.label || roleId;
      isCore = true;
    }

    roles.push({
      id: roleId,
      label: roleLabel,
      isCore,
      fieldCount: profileConfig.fields?.length || 0,
    });
  }

  return roles;
}

/**
 * メイン処理
 */
export default async function deleteProfile(roleIdArg) {
  console.log("\n=== プロフィール削除 ===\n");

  // プロフィール設定があるロールを取得
  const roles = getRolesWithProfile();

  if (roles.length === 0) {
    console.log("プロフィール設定が見つかりません。");
    return;
  }

  let selectedRoleId = roleIdArg;

  // 引数がない場合は選択
  if (!selectedRoleId) {
    const { selected } = await prompt({
      type: "list",
      name: "selected",
      message: "削除するプロフィールを選択:",
      choices: roles.map((role) => ({
        name: `${role.label} (${role.id}) [${role.fieldCount}フィールド]${role.isCore ? " [コア]" : ""}`,
        value: role.id,
      })),
    });
    selectedRoleId = selected;
  }

  // 削除オプションの確認
  const { deleteEntity } = await prompt({
    type: "confirm",
    name: "deleteEntity",
    message: "生成フォルダ（generated/{roleId}/）も削除しますか？",
    default: true,
  });

  const { deleteJson } = await prompt({
    type: "confirm",
    name: "deleteJson",
    message: "プロフィール設定ファイル（*.profile.json）も削除しますか？",
    default: false,
  });

  // 最終確認
  const { confirm } = await prompt({
    type: "confirm",
    name: "confirm",
    message: `プロフィール "${selectedRoleId}" を削除します。よろしいですか？`,
    default: false,
  });

  if (!confirm) {
    console.log("\nキャンセルしました。");
    return;
  }

  // クリーンアップ実行
  console.log("");
  cleanupProfile(selectedRoleId, { deleteEntity });

  // JSON ファイルの削除
  if (deleteJson) {
    const jsonPath = path.join(PROFILES_DIR, `${selectedRoleId}.profile.json`);
    if (fs.existsSync(jsonPath)) {
      fs.unlinkSync(jsonPath);
      console.log(`  ✓ ${selectedRoleId}.profile.json を削除`);
    }
  }

  console.log("\n削除完了しました。\n");

  return selectedRoleId;
}

// 直接実行された場合
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const roleId = process.argv[2];

  deleteProfile(roleId).catch((err) => {
    console.error("エラー:", err.message);
    process.exit(1);
  });
}
