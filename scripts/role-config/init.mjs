#!/usr/bin/env node
// scripts/role-config/init.mjs
// ロール設定の対話型スクリプト

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import askRoleBasics from "./questions/role-basics.mjs";
import askProfileFields from "./questions/profile-fields.mjs";
import formatDomainConfig from "../domain-config/utils/formatConfig.mjs";

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
 */
function saveProfileConfig(roleId, fields) {
  const rootDir = path.resolve(__dirname, "..", "..");
  const profilesDir = path.join(rootDir, "src", "features", "core", "userProfile", "profiles");
  ensureDir(profilesDir);

  const profileConfig = {
    roleId,
    fields,
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
 * 次のステップを表示
 */
function showNextSteps(roleConfig, profileCreated) {
  console.log("\n=== 次のステップ ===\n");
  console.log("1. roles/index.ts にロールを追加:");
  console.log(`   import ${roleConfig.id}Role from "./${roleConfig.id}.role.json";`);
  console.log(`   // ALL_ROLES 配列に ${roleConfig.id}Role を追加\n`);

  if (profileCreated) {
    console.log("2. profiles/index.ts にプロフィールを追加:");
    console.log(`   import ${roleConfig.id}Profile from "./${roleConfig.id}.profile.json";`);
    console.log(`   // ALL_PROFILES 配列に ${roleConfig.id}Profile を追加\n`);

    console.log("3. プロフィールテーブルを生成:");
    console.log("   （自動生成スクリプトを実行）\n");
  }

  console.log(`${profileCreated ? "4" : "2"}. データベースに反映:`);
  console.log("   pnpm drizzle-kit push\n");
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
  let profileCreated = false;
  if (roleConfig.hasProfile) {
    const { fields } = await askProfileFields();

    if (fields.length > 0) {
      saveProfileConfig(roleConfig.id, fields);
      profileCreated = true;
    } else {
      console.log("\nプロフィールフィールドが空のため、プロフィール設定はスキップしました。");
    }
  }

  // 次のステップを表示
  showNextSteps(roleConfig, profileCreated);

  return roleConfig.id;
}

// 直接実行された場合
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  init().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
