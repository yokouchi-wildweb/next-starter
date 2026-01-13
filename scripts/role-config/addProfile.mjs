#!/usr/bin/env node
// scripts/role-config/addProfile.mjs
// 既存ロールにプロフィール設定を追加するスクリプト

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import askProfileFields from "./questions/profile-fields.mjs";
import formatDomainConfig from "../domain-config/utils/formatConfig.mjs";
import generate from "./generate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const ROLES_DIR = path.join(ROOT_DIR, "src/features/core/user/roles");
const PROFILES_DIR = path.join(ROOT_DIR, "src/features/core/userProfile/profiles");

const prompt = inquirer.createPromptModule();

/**
 * ディレクトリが存在しなければ作成
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

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
      return {
        id: content.id,
        label: content.label,
        hasProfile: content.hasProfile || false,
        isCore: content.isCore || false,
        filePath,
      };
    });
}

/**
 * プロフィール設定が存在するか確認
 */
function profileExists(roleId) {
  const profilePath = path.join(PROFILES_DIR, `${roleId}.profile.json`);
  return fs.existsSync(profilePath);
}

/**
 * プロフィール設定を保存
 */
function saveProfileConfig(roleId, fields) {
  ensureDir(PROFILES_DIR);

  const profileConfig = {
    roleId,
    fields,
  };

  const fileName = `${roleId}.profile.json`;
  const filePath = path.join(PROFILES_DIR, fileName);

  fs.writeFileSync(filePath, formatDomainConfig(profileConfig));
  console.log(`\nプロフィール設定を保存しました: ${filePath}`);

  return filePath;
}

/**
 * ロール設定の hasProfile を更新
 */
function updateRoleHasProfile(roleFilePath, hasProfile) {
  const content = JSON.parse(fs.readFileSync(roleFilePath, "utf-8"));
  content.hasProfile = hasProfile;
  fs.writeFileSync(roleFilePath, formatDomainConfig(content));
  console.log(`ロール設定を更新しました: hasProfile = ${hasProfile}`);
}

/**
 * メイン処理
 */
export default async function addProfile() {
  console.log("\n=== 既存ロールへのプロフィール追加 ===\n");

  // 既存ロールを取得
  const roles = getExistingRoles();

  if (roles.length === 0) {
    console.log("ロール設定が見つかりません。先に role:add でロールを作成してください。");
    return;
  }

  // ロール選択
  const { selectedRoleId } = await prompt({
    type: "list",
    name: "selectedRoleId",
    message: "プロフィールを追加するロールを選択:",
    choices: roles.map((role) => ({
      name: `${role.label} (${role.id})${role.hasProfile ? " [プロフィールあり]" : ""}${role.isCore ? " [コア]" : ""}`,
      value: role.id,
    })),
  });

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  // 既存プロフィールの確認
  if (profileExists(selectedRoleId)) {
    const { confirmOverwrite } = await prompt({
      type: "confirm",
      name: "confirmOverwrite",
      message: `プロフィール設定 "${selectedRoleId}.profile.json" は既に存在します。上書きしますか？`,
      default: false,
    });

    if (!confirmOverwrite) {
      console.log("\nキャンセルしました。");
      return;
    }
  }

  // プロフィールフィールドの収集
  const { fields } = await askProfileFields();

  if (fields.length === 0) {
    console.log("\nフィールドが定義されていないため、プロフィール設定は作成されませんでした。");
    return;
  }

  // プロフィール設定を保存
  saveProfileConfig(selectedRoleId, fields);

  // hasProfile の更新確認
  if (!selectedRole.hasProfile) {
    const { updateHasProfile } = await prompt({
      type: "confirm",
      name: "updateHasProfile",
      message: "ロール設定の hasProfile を true に変更しますか？",
      default: true,
    });

    if (updateHasProfile) {
      updateRoleHasProfile(selectedRole.filePath, true);
    }
  }

  // generate を実行するか確認
  const { runGenerate } = await prompt({
    type: "confirm",
    name: "runGenerate",
    message: "続けて role:generate を実行しますか？",
    default: true,
  });

  if (runGenerate) {
    // プロフィールのみ生成（ロール登録はスキップ）
    await generate(selectedRoleId, { profileOnly: true });
    console.log("\n=== 次のステップ ===\n");
    console.log("データベースに反映:");
    console.log("  pnpm drizzle-kit push\n");
  } else {
    console.log("\n=== 次のステップ ===\n");
    console.log("1. ジェネレータースクリプトを実行:");
    console.log(`   pnpm role:generate ${selectedRoleId}\n`);
    console.log("2. データベースに反映:");
    console.log("   pnpm drizzle-kit push\n");
  }

  return selectedRoleId;
}

// 直接実行された場合
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  addProfile().catch((err) => {
    console.error("エラー:", err.message);
    process.exit(1);
  });
}
