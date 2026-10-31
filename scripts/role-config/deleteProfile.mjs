#!/usr/bin/env node
// scripts/role-config/deleteProfile.mjs
// 使い方: pnpm prof:delete <roleId> --confirm <roleId> [--keep-generated] [--remove-json] [-i]
// 既定は対話なし: --confirm に同じ ID を渡したときだけ消す。entities/profiles/<roleId>/ は既定で消す（--keep-generated で残す）、
// 設定の JSON は既定で残す（--remove-json で消す）。-i のときだけ今までの対話（選択・確認）
// プロフィール関連のレジストリエントリを削除するスクリプト

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import { failUsage, parseRoleOpsArgs } from "./cliArgs.mjs";
import { findRoleFile } from "./rolePaths.mjs";
import { cleanupProfile } from "./generator/cleanupProfile.mjs";
import { removeOverride } from "./overrides.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const PROFILES_DIR = path.join(ROOT_DIR, "src/features/core/userProfile/profiles");

const prompt = inquirer.createPromptModule();
const USAGE = "pnpm prof:delete <roleId> --confirm <roleId> [--keep-generated] [--remove-json] [-i]";

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
    const roleFile = findRoleFile(roleId);
    const isCore = roleFile?.isCore ?? false;

    if (roleFile) {
      const roleConfig = JSON.parse(fs.readFileSync(roleFile.filePath, "utf-8"));
      roleLabel = roleConfig.label || roleId;
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
export default async function deleteProfile(roleIdArg, options = {}) {
  const { interactive = false } = options;
  console.log("\n=== プロフィール削除 ===\n");

  // プロフィール設定があるロールを取得
  const roles = getRolesWithProfile();

  if (roles.length === 0) {
    console.log("プロフィール設定が見つかりません。");
    process.exitCode = 1;
    return;
  }

  let selectedRoleId = roleIdArg;

  // 引数がない場合は選択（-i のときだけ）
  if (!selectedRoleId && !interactive) {
    failUsage("ロール ID を指定してください（選んで消すなら -i）", USAGE);
    return;
  }
  if (selectedRoleId && !roles.some((role) => role.id === selectedRoleId)) {
    console.log(`エラー: "${selectedRoleId}" のプロフィール設定が見つかりません。`);
    process.exitCode = 1;
    return;
  }
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

  let deleteEntity = !options.keepGenerated;
  let deleteJson = Boolean(options.removeJson);
  if (interactive) {
    // 削除オプションの確認
    ({ deleteEntity } = await prompt({
      type: "confirm",
      name: "deleteEntity",
      message: "生成フォルダ（entities/profiles/{roleId}/）も削除しますか？",
      default: true,
    }));
    ({ deleteJson } = await prompt({
      type: "confirm",
      name: "deleteJson",
      message: "プロフィール設定ファイル（*.profile.json）も削除しますか？",
      default: false,
    }));
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
  } else if (options.confirm !== selectedRoleId) {
    failUsage(
      `${options.confirm === undefined ? "削除するには --confirm でロール ID を渡してください" : `--confirm "${options.confirm}" がロール ID と一致しません`}` +
        `（消すもの: プロフィールの登録${deleteEntity ? "・entities/profiles/" + selectedRoleId + "/" : ""}${deleteJson ? "・" + selectedRoleId + ".profile.json" : ""}）。実行: pnpm prof:delete ${selectedRoleId} --confirm ${selectedRoleId}`,
      USAGE,
    );
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
    if (removeOverride(PROFILES_DIR, `${selectedRoleId}.profile.json`)) console.log(`  ✓ ${selectedRoleId}.profile.override.ts を削除`);
  }

  console.log("\n削除完了しました。\n");

  return selectedRoleId;
}

// 直接実行された場合
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { positional, interactive, values, flags } = parseRoleOpsArgs(process.argv.slice(2), { values: ["confirm"], flags: ["keep-generated", "remove-json"] });
    deleteProfile(positional, { interactive, confirm: values.confirm, keepGenerated: flags.has("keep-generated"), removeJson: flags.has("remove-json") }).catch((err) => {
      console.error("エラー:", err.message);
      process.exit(1);
    });
  } catch (err) {
    failUsage(err.message, USAGE);
  }
}
