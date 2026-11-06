#!/usr/bin/env node
// scripts/structure/role/deleteRole.mjs
// 使い方: pnpm generate role -- --delete <roleId> --confirm <roleId> [--keep-generated] [--remove-json] [-i]
// 既定は対話なし: --confirm に同じ ID を渡したときだけ消す。entities/profiles/<roleId>/ は既定で消す（--keep-generated で残す）、
// 設定の JSON は既定で残す（--remove-json で消す）。-i のときだけ今までの対話（選択・確認）
// ロール関連のレジストリエントリを削除するスクリプト

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import { failUsage, parseRoleOpsArgs } from "./cliArgs.mjs";
import { cleanupRole } from "./generator/cleanupRole.mjs";
import { overrideFileName, removeOverride } from "./overrides.mjs";
import { listRoleFiles, ROLES_DIR } from "./rolePaths.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../..");
const PROFILES_DIR = path.join(ROOT_DIR, "src/features/core/userProfile/profiles");

const prompt = inquirer.createPromptModule();
const USAGE = "pnpm generate role -- --delete <roleId> --confirm <roleId> [--keep-generated] [--remove-json] [-i]";

/**
 * 既存のロール設定を取得
 */
function getExistingRoles() {
  return listRoleFiles()
    .map(({ fileName, filePath, isCore }) => {
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));

      // プロフィール設定の存在確認
      const profilePath = path.join(PROFILES_DIR, `${content.id}.profile.json`);
      const hasProfile = fs.existsSync(profilePath);

      return {
        id: content.id,
        label: content.label,
        hasProfile,
        isCore,
        filePath,
        fileName,
      };
    });
}

/**
 * メイン処理
 */
export default async function deleteRole(roleIdArg, options = {}) {
  const { interactive = false } = options;
  console.log("\n=== ロール削除 ===\n");

  // 既存ロールを取得
  const roles = getExistingRoles();

  if (roles.length === 0) {
    console.log("ロール設定が見つかりません。");
    process.exitCode = 1;
    return;
  }

  let selectedRoleId = roleIdArg;
  let selectedRole;

  // 引数がない場合は選択（-i のときだけ）
  if (!selectedRoleId && !interactive) {
    failUsage("ロール ID を指定してください（選んで消すなら -i）", USAGE);
    return;
  }
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
      process.exitCode = 1;
      return;
    }
  }

  // core ロールは消せない
  if (selectedRole.isCore) {
    console.error(`エラー: core ロール「${selectedRoleId}」は削除できません。`);
    process.exitCode = 1;
    return;
  }

  let deleteEntity = !options.keepGenerated;
  let deleteJsonFiles = Boolean(options.removeJson);
  if (interactive) {
    // 削除オプションの確認
    ({ deleteEntity } = await prompt({
      type: "confirm",
      name: "deleteEntity",
      message: "生成フォルダ（entities/profiles/{roleId}/）も削除しますか？",
      default: true,
    }));
    ({ deleteJsonFiles } = await prompt({
      type: "confirm",
      name: "deleteJsonFiles",
      message: "設定ファイル（*.role.json, *.profile.json）も削除しますか？",
      default: false,
    }));
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
  } else if (options.confirm !== selectedRoleId) {
    failUsage(
      `${options.confirm === undefined ? "削除するには --confirm でロール ID を渡してください" : `--confirm "${options.confirm}" がロール ID と一致しません`}` +
        `（消すもの: ロールの一覧の登録${deleteEntity ? "・entities/profiles/" + selectedRoleId + "/" : ""}${deleteJsonFiles ? "・設定の JSON" : ""}）。実行: pnpm generate role -- --delete ${selectedRoleId} --confirm ${selectedRoleId}`,
      USAGE,
    );
    return;
  }

  // クリーンアップ実行
  console.log("");
  // JSON ごと消すときは hasProfile を書き戻す先が無い（上書きが hasProfile を決めていても止めない）
  cleanupRole(selectedRoleId, { includeProfile: true, deleteEntity, updateHasProfile: !deleteJsonFiles });

  // JSON ファイルの削除（隣の上書きも一緒に）
  if (deleteJsonFiles) {
    // ロール設定ファイル
    if (fs.existsSync(selectedRole.filePath)) {
      fs.unlinkSync(selectedRole.filePath);
      console.log(`  ✓ ${selectedRole.fileName} を削除`);
    }
    if (removeOverride(ROLES_DIR, selectedRole.fileName)) console.log(`  ✓ ${overrideFileName(selectedRole.fileName)} を削除`);

    // プロフィール設定ファイル
    const profileFile = `${selectedRoleId}.profile.json`;
    const profilePath = path.join(PROFILES_DIR, profileFile);
    if (fs.existsSync(profilePath)) {
      fs.unlinkSync(profilePath);
      console.log(`  ✓ ${profileFile} を削除`);
    }
    if (removeOverride(PROFILES_DIR, profileFile)) console.log(`  ✓ ${overrideFileName(profileFile)} を削除`);
  }

  console.log("\n削除完了しました。\n");

  return selectedRoleId;
}

// 直接実行された場合
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { positional, interactive, values, flags } = parseRoleOpsArgs(process.argv.slice(2), { values: ["confirm"], flags: ["keep-generated", "remove-json"] });
    deleteRole(positional, { interactive, confirm: values.confirm, keepGenerated: flags.has("keep-generated"), removeJson: flags.has("remove-json") }).catch((err) => {
      console.error("エラー:", err.message);
      process.exit(1);
    });
  } catch (err) {
    failUsage(err.message, USAGE);
  }
}
