#!/usr/bin/env node
// scripts/role-config/generate.mjs
// ロール設定からファイルを生成するスクリプト

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { updateRoleRegistry } from "./generator/updateRoleRegistry.mjs";
import { updateProfilesIndex } from "./generator/updateProfilesIndex.mjs";
import { generateProfileEntity } from "./generator/generateProfileEntity.mjs";
import { updateProfileRegistry } from "./generator/updateProfileRegistry.mjs";
import { cleanupProfile } from "./generator/cleanupProfile.mjs";
import { cleanupRole } from "./generator/cleanupRole.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");

/**
 * ロール設定JSONを読み込む
 * コアロールは _admin.role.json, _user.role.json のように _ プレフィックスがつく
 */
function loadRoleConfig(roleId) {
  const rolesDir = path.join(ROOT_DIR, "src/features/core/user/roles");

  // 通常のパスを試す
  let rolePath = path.join(rolesDir, `${roleId}.role.json`);

  // 存在しなければ _ プレフィックス付きを試す（コアロール）
  if (!fs.existsSync(rolePath)) {
    const coreRolePath = path.join(rolesDir, `_${roleId}.role.json`);
    if (fs.existsSync(coreRolePath)) {
      rolePath = coreRolePath;
    } else {
      throw new Error(`ロール設定が見つかりません: ${rolePath}`);
    }
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
 * ロールがすでに roleRegistry.ts に登録されているか確認
 */
function isRoleRegistered(roleId) {
  const registryPath = path.join(ROOT_DIR, "src/registry/roleRegistry.ts");
  const content = fs.readFileSync(registryPath, "utf-8");
  return content.includes(`${roleId}Role`);
}

/**
 * メイン処理
 * @param {string} roleId - ロールID
 * @param {Object} options - オプション
 * @param {boolean} options.profileOnly - プロフィール生成のみ行う（ロール登録はスキップ）
 */
export default async function generate(roleId, options = {}) {
  const { profileOnly = false } = options;

  console.log(`\n=== ロール "${roleId}" の生成を開始 ===\n`);

  // ロール設定を読み込み
  const roleConfig = loadRoleConfig(roleId);
  console.log(`ロール設定を読み込みました: ${roleConfig.label} (${roleConfig.id})`);

  // ロール登録（profileOnly でない場合のみ）
  if (!profileOnly) {
    // クリーンアップ（冪等性のため、既存エントリを削除してから追加）
    console.log("\n[1/5] 既存エントリをクリーンアップ中...");
    cleanupRole(roleId, { includeProfile: true, deleteEntity: true, silent: true });
    console.log("✓ クリーンアップ完了");

    // 2. roleRegistry.ts を更新
    console.log("\n[2/5] roleRegistry.ts を更新中...");
    updateRoleRegistry(roleConfig);
    console.log("✓ roleRegistry.ts を更新しました");
  } else {
    console.log("\n[1/5] roleRegistry.ts の更新をスキップ（プロフィールのみモード）");
  }

  // hasProfile: true の場合のみプロフィール関連を生成
  if (roleConfig.hasProfile) {
    // プロフィール設定を読み込み
    const profileConfig = loadProfileConfig(roleId);
    if (!profileConfig) {
      console.log(`\n⚠ プロフィール設定が見つかりません: ${roleId}.profile.json`);
      console.log("hasProfile: true ですが、プロフィール設定がないためスキップします。\n");
      return;
    }

    // profileOnly モードの場合のみクリーンアップ（フルモードは cleanupRole で実行済み）
    if (profileOnly) {
      console.log("\n[2/5] 既存エントリをクリーンアップ中...");
      cleanupProfile(roleId, { deleteEntity: true, silent: true });
      console.log("✓ クリーンアップ完了");
    }

    // profiles/index.ts を更新
    console.log("\n[3/5] profiles/index.ts を更新中...");
    updateProfilesIndex(roleConfig);
    console.log("✓ profiles/index.ts を更新しました");

    // entities/{role}Profile.ts を生成
    console.log("\n[4/5] entities/{role}Profile.ts を生成中...");
    generateProfileEntity(roleConfig, profileConfig);
    console.log("✓ entities/{role}Profile.ts を生成しました");

    // registry を更新
    console.log("\n[5/5] registry を更新中...");
    updateProfileRegistry(roleConfig);
    console.log("✓ registry を更新しました");
  } else {
    console.log("\n[3-5] hasProfile: false のためプロフィール関連はスキップ");
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
