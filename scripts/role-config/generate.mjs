#!/usr/bin/env node
// scripts/role-config/generate.mjs
// ロール設定からファイルを生成するスクリプト

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { updateRolesIndex } from "./generator/updateRolesIndex.mjs";
import { updateProfilesIndex } from "./generator/updateProfilesIndex.mjs";
import { generateProfileEntity } from "./generator/generateProfileEntity.mjs";
import { updateProfileRegistry } from "./generator/updateProfileRegistry.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");

/**
 * ロール設定JSONを読み込む
 */
function loadRoleConfig(roleId) {
  const rolePath = path.join(
    ROOT_DIR,
    "src/features/core/user/roles",
    `${roleId}.role.json`
  );

  if (!fs.existsSync(rolePath)) {
    throw new Error(`ロール設定が見つかりません: ${rolePath}`);
  }

  return JSON.parse(fs.readFileSync(rolePath, "utf-8"));
}

/**
 * プロフィール設定JSONを読み込む
 */
function loadProfileConfig(roleId) {
  const profilePath = path.join(
    ROOT_DIR,
    "src/features/core/userProfile/profiles",
    `${roleId}.profile.json`
  );

  if (!fs.existsSync(profilePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(profilePath, "utf-8"));
}

/**
 * ロールがすでにindex.tsに登録されているか確認
 */
function isRoleRegistered(roleId) {
  const indexPath = path.join(
    ROOT_DIR,
    "src/features/core/user/roles/index.ts"
  );
  const content = fs.readFileSync(indexPath, "utf-8");
  return content.includes(`${roleId}Role`);
}

/**
 * メイン処理
 */
export default async function generate(roleId) {
  console.log(`\n=== ロール "${roleId}" の生成を開始 ===\n`);

  // ロール設定を読み込み
  const roleConfig = loadRoleConfig(roleId);
  console.log(`ロール設定を読み込みました: ${roleConfig.label} (${roleConfig.id})`);

  // すでに登録済みかチェック
  if (isRoleRegistered(roleId)) {
    console.log(`\n⚠ ロール "${roleId}" はすでに登録されています。`);
    console.log("再生成する場合は、先に既存の登録を削除してください。\n");
    return;
  }

  // 1. roles/index.ts を更新
  console.log("\n[1/4] roles/index.ts を更新中...");
  updateRolesIndex(roleConfig);
  console.log("✓ roles/index.ts を更新しました");

  // hasProfile: true の場合のみプロフィール関連を生成
  if (roleConfig.hasProfile) {
    // プロフィール設定を読み込み
    const profileConfig = loadProfileConfig(roleId);
    if (!profileConfig) {
      console.log(`\n⚠ プロフィール設定が見つかりません: ${roleId}.profile.json`);
      console.log("hasProfile: true ですが、プロフィール設定がないためスキップします。\n");
      return;
    }

    // 2. profiles/index.ts を更新
    console.log("\n[2/4] profiles/index.ts を更新中...");
    updateProfilesIndex(roleConfig);
    console.log("✓ profiles/index.ts を更新しました");

    // 3. entities/{role}Profile.ts を生成
    console.log("\n[3/4] entities/{role}Profile.ts を生成中...");
    generateProfileEntity(roleConfig, profileConfig);
    console.log("✓ entities/{role}Profile.ts を生成しました");

    // 4. registry を更新
    console.log("\n[4/4] registry を更新中...");
    updateProfileRegistry(roleConfig);
    console.log("✓ registry を更新しました");
  } else {
    console.log("\n[2-4] hasProfile: false のためプロフィール関連はスキップ");
  }

  console.log(`\n=== 生成完了 ===\n`);
  console.log("次のステップ:");
  console.log("  pnpm drizzle-kit push  # データベースに反映\n");
}

// 直接実行された場合
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const roleId = process.argv[2];

  if (!roleId) {
    console.error("使用方法: node generate.mjs <roleId>");
    console.error("例: node generate.mjs reviewer");
    process.exit(1);
  }

  generate(roleId).catch((err) => {
    console.error("エラー:", err.message);
    process.exit(1);
  });
}
