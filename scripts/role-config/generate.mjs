#!/usr/bin/env node
// scripts/role-config/generate.mjs
// ロール設定からファイルを生成するスクリプト
// 使い方: node generate.mjs <roleId> | node generate.mjs --all（全 *.role.json）
// 書く前に checks/ の検査を通す（問題は全件並べて止める。警告は表示して進む）

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
import { generateProfileFieldTypes } from "./generator/generateProfileFieldTypes.mjs";
import { generateProfilePresenters } from "./generator/generateProfilePresenters.mjs";
import { generateProfileIndex } from "./generator/generateProfileIndex.mjs";
import { updateGeneratedIndex } from "./generator/updateGeneratedIndex.mjs";
import { generateSchemaRegistry } from "./generator/generateSchemaRegistry.mjs";
import { toCamelCase } from "../../src/utils/stringCase.mjs";
import { assertRoleConfig, orphanProfileIssues, roleConfigIssues, roleConfigWarnings } from "./checks/index.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const ROLES_DIR = path.join(ROOT_DIR, "src/features/core/user/roles");
const PROFILES_DIR = path.join(ROOT_DIR, "src/features/core/userProfile/profiles");

/**
 * ロール設定JSONを読み込む
 * コアロールは _admin.role.json, _user.role.json のように _ プレフィックスがつく
 * @returns {{ fileName: string, role: object }}
 */
function loadRoleConfig(roleId) {
  // 通常のパスを試し、無ければ _ プレフィックス付き（コアロール）
  const fileName = [`${roleId}.role.json`, `_${roleId}.role.json`].find((name) => fs.existsSync(path.join(ROLES_DIR, name)));
  if (!fileName) {
    throw new Error(`ロール設定が見つかりません: ${path.join(ROLES_DIR, `${roleId}.role.json`)}`);
  }
  return { fileName, role: JSON.parse(fs.readFileSync(path.join(ROLES_DIR, fileName), "utf-8")) };
}

/**
 * プロフィール設定JSONを読み込む
 */
function loadProfileConfig(roleId) {
  const profilePath = path.join(PROFILES_DIR, `${roleId}.profile.json`);

  if (!fs.existsSync(profilePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(profilePath, "utf-8"));
}

/** 検査の入力（ロール設定のファイル名・中身とプロフィール設定） */
function loadCheckInput(roleId) {
  const { fileName, role } = loadRoleConfig(roleId);
  return { fileName, role, profile: loadProfileConfig(role.id ?? roleId) };
}

function printWarnings(warnings) {
  for (const warning of warnings) console.warn(`⚠ ${warning}`);
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

  // ロール設定を読み込み、書く前に検査する（問題があれば全件を並べて止める）
  const checkInput = loadCheckInput(roleId);
  assertRoleConfig(checkInput);
  printWarnings(roleConfigWarnings(checkInput));
  const roleConfig = checkInput.role;
  console.log(`ロール設定を読み込みました: ${roleConfig.label} (${roleConfig.id})`);

  // ロール登録（profileOnly でない場合のみ）
  if (!profileOnly) {
    // クリーンアップ（冪等性のため、既存エントリを削除してから追加）
    console.log("\n[1/8] 既存エントリをクリーンアップ中...");
    // hasProfile: false でもプロフィール設定が残っているロールは、プロフィールの生成物を消さない（警告だけ）。
    // 消すと profileTableRegistry.ts が消えたファイルを読み続けて型検査が壊れる。プロフィールを消すのは role:delete / prof:delete
    const keepProfile = !roleConfig.hasProfile && checkInput.profile !== null;
    cleanupRole(roleId, { includeProfile: !keepProfile, deleteEntity: true, updateHasProfile: false, silent: true });
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
    // tagsマッピングを解決（新形式 -> 旧形式互換）。プロフィール設定があることは検査で確かめた
    const profileConfig = resolveTagsMapping(checkInput.profile);

    // profileOnly モードの場合のみクリーンアップ（フルモードは cleanupRole で実行済み）
    if (profileOnly) {
      console.log("\n[2/8] 既存エントリをクリーンアップ中...");
      cleanupProfile(roleId, { deleteEntity: true, updateHasProfile: false, silent: true });
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

    const hasFieldTypes = generateProfileFieldTypes(roleConfig, profileConfig);
    if (hasFieldTypes) {
      console.log("  ✓ fieldTypes.ts");
    }

    generateProfileIndex(roleConfig, profileConfig, hasFieldConstants, hasFieldTypes);
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
    updateProfileRegistry();
    console.log("✓ registry を更新しました");

    console.log("\n[8/8] 完了");
  } else {
    console.log("\n[3-7] hasProfile: false のためプロフィール関連はスキップ");
  }

  console.log(`\n=== 生成完了 ===\n`);
  console.log("次のステップ:");
  console.log("  pnpm db:push  # データベースに反映\n");
}

/** 一覧のファイル名から ID を取る（_admin.role.json → admin） */
const idsIn = (dir, suffix) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => name.endsWith(suffix)).map((name) => name.slice(0, -suffix.length).replace(/^_/, "")).sort()
    : [];

/**
 * 全 *.role.json とプロフィール設定を検査する（何も書かない。forge の事前検査も使う）
 * @param {string[]} [roleIds] 検査するロール（既定 = 全 *.role.json）
 * @returns {string[]} 問題（空なら無し）
 */
export function checkAllRoles(roleIds = idsIn(ROLES_DIR, ".role.json")) {
  return [
    ...roleIds.flatMap((roleId) => roleConfigIssues(loadCheckInput(roleId))),
    ...orphanProfileIssues(roleIds, idsIn(PROFILES_DIR, ".profile.json")),
  ];
}

/**
 * roleRegistry.ts の ALL_ROLES に今ある順の ID（生成は 1 ロールずつ消して末尾に足すので、この順に回すと並びが変わらない）
 */
function registeredRoleOrder() {
  const registryPath = path.join(ROOT_DIR, "src/registry/roleRegistry.ts");
  if (!fs.existsSync(registryPath)) return [];
  const content = fs.readFileSync(registryPath, "utf-8");
  const start = content.indexOf("// === AUTO-GENERATED ENTRIES START ===");
  const end = content.indexOf("// === AUTO-GENERATED ENTRIES END ===");
  if (start === -1 || end === -1) return [];
  return [...content.slice(start, end).matchAll(/^\s*(\w+)Role as RoleConfig/gm)].map((match) => match[1]);
}

/**
 * 全 *.role.json を生成する。先に全ロールを検査し、どれか 1 つでも問題があれば何も書かずに止める。
 * 順は roleRegistry.ts の今の並び → 未登録のロール（ID 順）
 */
export async function generateAll() {
  const fileIds = idsIn(ROLES_DIR, ".role.json");
  const order = registeredRoleOrder();
  const rank = (id) => {
    const index = order.indexOf(toCamelCase(id));
    return index === -1 ? order.length : index;
  };
  const roleIds = [...fileIds].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const issues = checkAllRoles(roleIds);
  if (issues.length > 0) throw new Error(issues.join("\n"));
  for (const roleId of roleIds) await generate(roleId);
  console.log(`=== 全 ${roleIds.length} ロールの生成完了 ===`);
}

// 直接実行された場合
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];

  if (!arg) {
    console.error("使用方法: node generate.mjs <roleId> | node generate.mjs --all");
    console.error("例: node generate.mjs reviewer");
    process.exit(1);
  }

  (arg === "--all" ? generateAll() : generate(arg)).catch((err) => {
    console.error("エラー:", err.message);
    process.exit(1);
  });
}
