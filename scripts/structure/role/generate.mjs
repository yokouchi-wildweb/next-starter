#!/usr/bin/env node
// scripts/structure/role/generate.mjs
// ロール設定からファイルを生成するスクリプト
// 使い方: node generate.mjs <roleId> | node generate.mjs --all（coreRoles/・roles/ の全 *.role.json）
// 書く前に checks/ の検査を通す（問題は全件並べて止める。警告は表示して進む）

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { addRoleToList, registeredRoleIds, writeProfileLists } from "./generator/writeLists.mjs";
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
import { readRegisteredFormInputs } from "../domain/domain/formInputNames.mjs";
import { createWorkspace } from "../domain/domain/workspace.mjs";
import { assertRoleConfig, orphanProfileIssues, roleConfigIssues, roleConfigWarnings, roleFolderIssues } from "./checks/index.mjs";
import { readProfileOverride, readRoleOverride, strayOverrideIssues } from "./overrides.mjs";
import { addedRoleFileNames, CORE_ROLES_DIR, coreRoleFileNames, findRoleFile, listRoleFiles, roleFileOf, ROLES_DIR } from "./rolePaths.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../..");
const PROFILES_DIR = path.join(ROOT_DIR, "src/features/core/userProfile/profiles");

/**
 * ロール設定JSONを読み込む（隣の上書きを重ねる）
 * @returns {{ fileName: string, role: object, problems: string[] }}
 */
function loadRoleConfig(roleId) {
  const file = findRoleFile(roleId);
  if (!file) {
    throw new Error(`ロール設定が見つかりません: ${roleFileOf(roleId).filePath}`);
  }
  const { override, problems } = readRoleOverride(file);
  return { fileName: file.fileName, role: { ...JSON.parse(fs.readFileSync(file.filePath, "utf-8")), ...override }, problems };
}

/**
 * プロフィール設定JSONを読み込む（隣の上書きを重ねる）
 * @returns {{ profile: object | null, problems: string[] }}
 */
function loadProfileConfig(roleId) {
  const fileName = `${roleId}.profile.json`;
  const profilePath = path.join(PROFILES_DIR, fileName);

  if (!fs.existsSync(profilePath)) {
    return { profile: null, problems: [] };
  }

  const { override, problems } = readProfileOverride(PROFILES_DIR, fileName);
  return { profile: { ...JSON.parse(fs.readFileSync(profilePath, "utf-8")), ...override }, problems };
}

/** 検査の入力（ロール設定のファイル名・上書き後の中身とプロフィール設定、上書きの問題） */
function loadCheckInput(roleId) {
  const { fileName, role, problems: roleProblems } = loadRoleConfig(roleId);
  const { profile, problems: profileProblems } = loadProfileConfig(role.id ?? roleId);
  return { fileName, role, profile, overrideProblems: [...roleProblems, ...profileProblems], registeredInputs: readRegisteredFormInputs(createWorkspace(ROOT_DIR)) };
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
  const placement = placementIssues();
  if (placement.length > 0) throw new Error(placement.join("\n"));
  const checkInput = loadCheckInput(roleId);
  assertRoleConfig(checkInput);
  printWarnings(roleConfigWarnings(checkInput));
  const roleConfig = checkInput.role;
  console.log(`ロール設定を読み込みました: ${roleConfig.label} (${roleConfig.id})`);

  // ロール登録（profileOnly でない場合のみ）
  if (!profileOnly) {
    // クリーンアップ（冪等性のため、既存エントリを削除してから追加）
    console.log("\n[1/4] 既存エントリをクリーンアップ中...");
    // hasProfile: false でもプロフィール設定が残っているロールは、プロフィールの生成物を消さない（警告だけ）。
    // 消すと一覧が消えたファイルを読み続けて型検査が壊れる。プロフィールを消すのは pnpm generate role -- --delete / pnpm generate role -- --delete-profile
    const keepProfile = !roleConfig.hasProfile && checkInput.profile !== null;
    cleanupRole(roleId, { includeProfile: !keepProfile, deleteEntity: true, updateHasProfile: false, silent: true });
    console.log("✓ クリーンアップ完了");

    // 2. ロールの一覧を更新
    console.log("\n[2/4] user/extensions/roles.ts を更新中...");
    addRoleToList(roleConfig);
    console.log("✓ user/extensions/roles.ts を更新しました");
  } else {
    console.log("\n[1/4] user/extensions/roles.ts の更新をスキップ（プロフィールのみモード）");
  }

  // hasProfile: true の場合のみプロフィール関連を生成
  if (roleConfig.hasProfile) {
    // tagsマッピングを解決（新形式 -> 旧形式互換）。プロフィール設定があることは検査で確かめた
    const profileConfig = resolveTagsMapping(checkInput.profile);

    // profileOnly モードの場合のみクリーンアップ（フルモードは cleanupRole で実行済み）
    if (profileOnly) {
      console.log("\n[2/4] 既存エントリをクリーンアップ中...");
      cleanupProfile(roleId, { deleteEntity: true, updateHasProfile: false, silent: true });
      console.log("✓ クリーンアップ完了");
    }

    // entities/profiles/{roleId}/ 配下のファイルを生成
    console.log("\n[3/4] entities/profiles/{roleId}/ を生成中...");
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

    // プロフィールの一覧を丸ごと書く
    console.log("\n[4/4] userProfile/extensions/ を更新中...");
    writeProfileLists();
    console.log("✓ userProfile/extensions/ を更新しました");
  } else {
    console.log("\n[3-4] hasProfile: false のためプロフィール関連はスキップ");
  }

  // hasProfile: false でプロフィールを残したロールがあるので、毎回一覧を合わせる
  writeProfileLists();

  console.log(`\n=== 生成完了 ===\n`);
  console.log("次のステップ:");
  console.log("  pnpm db:push  # データベースに反映\n");
}

/** ファイルの置き場の問題（core ロールの置き場、隣に対象の無い上書き） */
const placementIssues = () => [
  ...roleFolderIssues({ coreFileNames: coreRoleFileNames(), addedFileNames: addedRoleFileNames() }),
  ...strayOverrideIssues([CORE_ROLES_DIR, ROLES_DIR], PROFILES_DIR),
];

const profileIds = () =>
  fs.existsSync(PROFILES_DIR)
    ? fs.readdirSync(PROFILES_DIR).filter((name) => name.endsWith(".profile.json")).map((name) => name.slice(0, -".profile.json".length)).sort()
    : [];
const roleIdsOnDisk = () => listRoleFiles().map((file) => file.id).sort();

/**
 * 全 *.role.json とプロフィール設定を検査する（何も書かない。forge の事前検査も使う）
 * @param {string[]} [roleIds] 検査するロール（既定 = 全 *.role.json）
 * @returns {string[]} 問題（空なら無し）
 */
export function checkAllRoles(roleIds = roleIdsOnDisk()) {
  const placement = placementIssues();
  // 置き場が違うと読めないので、先にそれだけ返す
  if (placement.length > 0) return placement;
  return [
    ...roleIds.flatMap((roleId) => roleConfigIssues(loadCheckInput(roleId))),
    ...orphanProfileIssues(roleIds, profileIds()),
  ];
}

/**
 * 全ロールを生成する。先に全ロールを検査し、どれか 1 つでも問題があれば何も書かずに止める。
 * 順は user/extensions/roles.ts の今の並び → 未登録のロール（ID 順）
 */
export async function generateAll() {
  const placement = placementIssues();
  if (placement.length > 0) throw new Error(placement.join("\n"));
  const fileIds = roleIdsOnDisk();
  const order = registeredRoleIds();
  const rank = (id) => {
    const index = order.indexOf(id);
    return index === -1 ? order.length : index;
  };
  // 一覧に無いロールはコアロールを先に（一覧が無い初回でも _admin・_user が先頭）
  const coreFirst = (id) => (roleFileOf(id).isCore ? 0 : 1);
  const roleIds = [...fileIds].sort((a, b) => rank(a) - rank(b) || coreFirst(a) - coreFirst(b) || a.localeCompare(b));
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
