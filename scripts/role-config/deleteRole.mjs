#!/usr/bin/env node
// scripts/role-config/deleteRole.mjs
// ロール関連のレジストリエントリを削除するスクリプト

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import { cleanupRole } from "./generator/cleanupRole.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const ROLES_DIR = path.join(ROOT_DIR, "src/features/core/user/roles");
const PROFILES_DIR = path.join(ROOT_DIR, "src/features/core/userProfile/profiles");

const prompt = inquirer.createPromptModule();

/**
 * 既存のロール設定を取得
 */
function getExistingRoles() {
  if (!fs.existsSync(ROLES_DIR)) {
    return [];
  }

  const files = fs.readdirSync(ROLES_DIR);
  return files
    .filter((file) => file.endsWith(".role.json"))
    .map((file) => {
      const filePath = path.join(ROLES_DIR, file);
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const isCore = file.startsWith("_") || content.isCore;

      // プロフィール設定の存在確認
      const profilePath = path.join(PROFILES_DIR, `${content.id}.profile.json`);
      const hasProfile = fs.existsSync(profilePath);

      return {
        id: content.id,
        label: content.label,
        hasProfile,
        isCore,
        filePath,
        fileName: file,
      };
    });
}

/**
 * メイン処理
 */
export default async function deleteRole(roleIdArg) {
  console.log("\n=== ロール削除 ===\n");

  // 既存ロールを取得
  const roles = getExistingRoles();

  if (roles.length === 0) {
    console.log("ロール設定が見つかりません。");
    return;
  }

  let selectedRoleId = roleIdArg;
  let selectedRole;

  // 引数がない場合は選択
  if (!selectedRoleId) {
    const { selected } = await prompt({
      type: "list",
      name: "selected",
      message: "削除するロールを選択:",
      choices: roles.map((role) => ({
        name: `${role.label} (${role.id})${role.hasProfile ? " [プロフィールあり]" : ""}${role.isCore ? " [コア]" : ""}`,
        value: role.id,
      })),
    });
    selectedRoleId = selected;
    selectedRole = roles.find((r) => r.id === selectedRoleId);
  } else {
    selectedRole = roles.find((r) => r.id === selectedRoleId);
    if (!selectedRole) {
      console.log(`エラー: ロール "${selectedRoleId}" が見つかりません。`);
      return;
    }
  }

  // コアロールの警告
  if (selectedRole.isCore) {
    console.log("\n⚠ 警告: これはコアロールです。削除すると重大な問題が発生する可能性があります。\n");
  }

  // 削除オプションの確認
  const { deleteEntity } = await prompt({
    type: "confirm",
    name: "deleteEntity",
    message: "生成フォルダ（generated/{roleId}/）も削除しますか？",
    default: true,
  });

  const { deleteJsonFiles } = await prompt({
    type: "confirm",
    name: "deleteJsonFiles",
    message: "設定ファイル（*.role.json, *.profile.json）も削除しますか？",
    default: false,
  });

  // 最終確認
  const { confirm } = await prompt({
    type: "confirm",
    name: "confirm",
    message: `ロール "${selectedRoleId}" を削除します。よろしいですか？`,
    default: false,
  });

  if (!confirm) {
    console.log("\nキャンセルしました。");
    return;
  }

  // クリーンアップ実行
  console.log("");
  cleanupRole(selectedRoleId, { includeProfile: true, deleteEntity });

  // JSON ファイルの削除
  if (deleteJsonFiles) {
    // ロール設定ファイル
    if (fs.existsSync(selectedRole.filePath)) {
      fs.unlinkSync(selectedRole.filePath);
      console.log(`  ✓ ${selectedRole.fileName} を削除`);
    }

    // プロフィール設定ファイル
    const profilePath = path.join(PROFILES_DIR, `${selectedRoleId}.profile.json`);
    if (fs.existsSync(profilePath)) {
      fs.unlinkSync(profilePath);
      console.log(`  ✓ ${selectedRoleId}.profile.json を削除`);
    }
  }

  console.log("\n削除完了しました。\n");

  return selectedRoleId;
}

// 直接実行された場合
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const roleId = process.argv[2];

  deleteRole(roleId).catch((err) => {
    console.error("エラー:", err.message);
    process.exit(1);
  });
}
