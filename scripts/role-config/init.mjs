#!/usr/bin/env node
// scripts/role-config/init.mjs
// ロール設定の対話型スクリプト

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import askRoleBasics from "./questions/role-basics.mjs";
import askProfileFields from "./questions/profile-fields.mjs";
import formatDomainConfig from "../domain-config/utils/formatConfig.mjs";
import generate from "./generate.mjs";

const prompt = inquirer.createPromptModule();

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * ディレクトリが存在しなければ作成
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * ロール設定を保存
 */
function saveRoleConfig(roleConfig) {
  const rootDir = path.resolve(__dirname, "..", "..");
  const rolesDir = path.join(rootDir, "src", "features", "core", "user", "roles");
  ensureDir(rolesDir);

  const fileName = `${roleConfig.id}.role.json`;
  const filePath = path.join(rolesDir, fileName);

  // 既存ファイルのチェック
  if (fs.existsSync(filePath)) {
    console.error(`エラー: ${fileName} は既に存在します。`);
    process.exit(1);
  }

  fs.writeFileSync(filePath, formatDomainConfig(roleConfig));
  console.log(`\nロール設定を作成しました: ${filePath}`);

  return filePath;
}

/**
 * プロフィール設定を保存
 * @param {string} roleId - ロールID
 * @param {Array} fields - フィールド定義
 * @param {Object} tags - タグマッピング
 */
function saveProfileConfig(roleId, fields, tags) {
  const rootDir = path.resolve(__dirname, "..", "..");
  const profilesDir = path.join(rootDir, "src", "features", "core", "userProfile", "profiles");
  ensureDir(profilesDir);

  const profileConfig = {
    roleId,
    fields,
    tags,
  };

  const fileName = `${roleId}.profile.json`;
  const filePath = path.join(profilesDir, fileName);

  // 既存ファイルのチェック
  if (fs.existsSync(filePath)) {
    console.error(`エラー: ${fileName} は既に存在します。`);
    process.exit(1);
  }

  fs.writeFileSync(filePath, formatDomainConfig(profileConfig));
  console.log(`プロフィール設定を作成しました: ${filePath}`);

  return filePath;
}

/**
 * generate を実行するか確認
 */
async function confirmAndGenerate(roleId) {
  const { runGenerate } = await prompt({
    type: "confirm",
    name: "runGenerate",
    message: "続けて role:generate を実行しますか？",
    default: true,
  });

  if (runGenerate) {
    await generate(roleId);
    console.log("\n=== 次のステップ ===\n");
    console.log("データベースに反映:");
    console.log("  pnpm drizzle-kit push\n");
  } else {
    console.log("\n=== 次のステップ ===\n");
    console.log("1. ジェネレータースクリプトを実行:");
    console.log(`   pnpm role:generate ${roleId}\n`);
    console.log("2. データベースに反映:");
    console.log("   pnpm drizzle-kit push\n");
  }
}

/**
 * メイン処理
 */
export default async function init() {
  console.log("\n=== ロール設定の作成 ===\n");

  // ロール基本設定の収集
  const roleConfig = await askRoleBasics();

  // ロール設定を保存
  saveRoleConfig(roleConfig);

  // プロフィールフィールドの収集（hasProfile: true の場合）
  if (roleConfig.hasProfile) {
    const { fields, tags } = await askProfileFields();

    if (fields.length > 0) {
      saveProfileConfig(roleConfig.id, fields, tags);
    } else {
      console.log("\nプロフィールフィールドが空のため、プロフィール設定はスキップしました。");
    }
  }

  // generate を実行するか確認
  await confirmAndGenerate(roleConfig.id);

  return roleConfig.id;
}

// 直接実行された場合
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  init().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
