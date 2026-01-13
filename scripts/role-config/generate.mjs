#!/usr/bin/env node
// scripts/role-config/generate.mjs
// ロール設定からファイルを生成するスクリプト

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { updateRoleRegistry } from "./generator/updateRoleRegistry.mjs";
import { updateProfilesIndex } from "./generator/updateProfilesIndex.mjs";
import { updateProfileRegistry } from "./generator/updateProfileRegistry.mjs";
import { cleanupProfile } from "./generator/cleanupProfile.mjs";
import { cleanupRole } from "./generator/cleanupRole.mjs";
// 新しいジェネレーター
import { generateProfileDrizzle } from "./generator/generateProfileDrizzle.mjs";
import { generateProfileSchema } from "./generator/generateProfileSchema.mjs";
import { generateProfileForm } from "./generator/generateProfileForm.mjs";
import { generateProfileModel } from "./generator/generateProfileModel.mjs";
import { generateProfileFieldConstants } from "./generator/generateProfileFieldConstants.mjs";
import { generateProfilePresenters } from "./generator/generateProfilePresenters.mjs";
import { generateProfileIndex } from "./generator/generateProfileIndex.mjs";
import { updateGeneratedIndex } from "./generator/updateGeneratedIndex.mjs";
import { generateSchemaRegistry } from "./generator/generateSchemaRegistry.mjs";

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
 * tagsマッピングからフィールドにtagsを付与
 * 新形式: { fields: [...], tags: { registration: ["field1"], ... } }
 * 旧形式: { fields: [{ ..., tags: ["registration"] }] }
 * @param {Object} profileConfig - プロフィール設定
 * @returns {Object} tagsが各フィールドに付与されたプロフィール設定
 */
function resolveTagsMapping(profileConfig) {
  const { fields, tags } = profileConfig;

  // 旧形式（フィールドに直接tagsがある場合）はそのまま返す
  if (!tags || fields.some((f) => Array.isArray(f.tags))) {
    return profileConfig;
  }

  // 新形式: tagsマッピングからフィールドにtagsを付与
  const fieldTagsMap = new Map();

  // タグマッピングを反転してフィールド -> タグの配列に変換
  for (const [tagName, fieldNames] of Object.entries(tags)) {
    for (const fieldName of fieldNames) {
      if (!fieldTagsMap.has(fieldName)) {
        fieldTagsMap.set(fieldName, []);
      }
      fieldTagsMap.get(fieldName).push(tagName);
    }
  }

  // フィールドにtagsを付与
  const resolvedFields = fields.map((field) => ({
    ...field,
    tags: fieldTagsMap.get(field.name) || [],
  }));

  return {
    ...profileConfig,
    fields: resolvedFields,
  };
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
    console.log("\n[1/8] 既存エントリをクリーンアップ中...");
    cleanupRole(roleId, { includeProfile: true, deleteEntity: true, silent: true });
    console.log("✓ クリーンアップ完了");

    // 2. roleRegistry.ts を更新
    console.log("\n[2/8] roleRegistry.ts を更新中...");
    updateRoleRegistry(roleConfig);
    console.log("✓ roleRegistry.ts を更新しました");
  } else {
    console.log("\n[1/8] roleRegistry.ts の更新をスキップ（プロフィールのみモード）");
  }

  // hasProfile: true の場合のみプロフィール関連を生成
  if (roleConfig.hasProfile) {
    // プロフィール設定を読み込み
    const rawProfileConfig = loadProfileConfig(roleId);
    if (!rawProfileConfig) {
      console.log(`\n⚠ プロフィール設定が見つかりません: ${roleId}.profile.json`);
      console.log("hasProfile: true ですが、プロフィール設定がないためスキップします。\n");
      return;
    }

    // tagsマッピングを解決（新形式 -> 旧形式互換）
    const profileConfig = resolveTagsMapping(rawProfileConfig);

    // profileOnly モードの場合のみクリーンアップ（フルモードは cleanupRole で実行済み）
    if (profileOnly) {
      console.log("\n[2/8] 既存エントリをクリーンアップ中...");
      cleanupProfile(roleId, { deleteEntity: true, silent: true });
      console.log("✓ クリーンアップ完了");
    }

    // profiles/index.ts を更新
    console.log("\n[3/8] profiles/index.ts を更新中...");
    updateProfilesIndex(roleConfig);
    console.log("✓ profiles/index.ts を更新しました");

    // generated/{roleId}/ 配下のファイルを生成
    console.log("\n[4/8] generated/{roleId}/ を生成中...");
    generateProfileDrizzle(roleConfig, profileConfig);
    console.log("  ✓ drizzle.ts");
    generateProfileSchema(roleConfig, profileConfig);
    console.log("  ✓ schema.ts");
    generateProfileForm(roleConfig, profileConfig);
    console.log("  ✓ form.ts");
    generateProfileModel(roleConfig, profileConfig);
    console.log("  ✓ model.ts");
    generateProfilePresenters(roleConfig, profileConfig);
    console.log("  ✓ presenters.ts");

    const hasFieldConstants = generateProfileFieldConstants(roleConfig, profileConfig);
    if (hasFieldConstants) {
      console.log("  ✓ fieldConstants.ts");
    }

    generateProfileIndex(roleConfig, profileConfig, hasFieldConstants);
    console.log("  ✓ index.ts");

    // generated/index.ts を更新
    console.log("\n[5/8] generated/index.ts を更新中...");
    updateGeneratedIndex();
    console.log("✓ generated/index.ts を更新しました");

    // schemaRegistry.ts を更新
    console.log("\n[6/8] schemaRegistry.ts を更新中...");
    generateSchemaRegistry();
    console.log("✓ schemaRegistry.ts を更新しました");

    // registry を更新
    console.log("\n[7/8] registry を更新中...");
    updateProfileRegistry(roleConfig);
    console.log("✓ registry を更新しました");

    console.log("\n[8/8] 完了");
  } else {
    console.log("\n[3-7] hasProfile: false のためプロフィール関連はスキップ");
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
