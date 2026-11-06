#!/usr/bin/env node
// scripts/structure/role/generateProfile.mjs
// 既存のプロフィール設定に対して生成処理のみを実行するスクリプト
// 使い方: pnpm generate role -- --profile <roleId> | --all（プロフィールのある全ロール）。既定は対話なし、-i のときだけロールを選ぶ。
// プロフィール設定が見つからなければ終了コード 1

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import generate from "./generate.mjs";
import { failUsage, parseRoleOpsArgs } from "./cliArgs.mjs";
import { findRoleFile } from "./rolePaths.mjs";

const USAGE = "pnpm generate role -- --profile <roleId> | --all [-i]";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../..");
const PROFILES_DIR = path.join(ROOT_DIR, "src/features/core/userProfile/profiles");

const prompt = inquirer.createPromptModule();

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
export default async function generateProfile(roleIdArg, options = {}) {
  const { interactive = false, all = false } = options;
  console.log("\n=== プロフィール生成 ===\n");

  // プロフィール設定があるロールを取得
  const roles = getRolesWithProfile();

  if (roles.length === 0) {
    console.log("プロフィール設定が見つかりません。先に src/features/core/userProfile/profiles/<roleId>.profile.json を書き、role.json の hasProfile を true にしてください。");
    process.exitCode = 1;
    return;
  }

  if (all) {
    for (const role of roles) await generate(role.id, { profileOnly: true });
    console.log(`\n=== プロフィールのある全 ${roles.length} ロールを生成しました ===\n次: pnpm db:push（表が変わったとき）\n`);
    return roles.map((role) => role.id);
  }

  let selectedRoleId = roleIdArg;

  // 引数がない場合は選択（-i のときだけ）
  if (!selectedRoleId && !interactive) {
    failUsage("ロール ID か --all を指定してください（選んで生成するなら -i）", USAGE);
    return;
  }
  if (!selectedRoleId) {
    const { selected } = await prompt({
      type: "list",
      name: "selected",
      message: "生成するプロフィールを選択:",
      choices: roles.map((role) => ({
        name: `${role.label} (${role.id}) [${role.fieldCount}フィールド]${role.isCore ? " [コア]" : ""}`,
        value: role.id,
      })),
    });
    selectedRoleId = selected;
  } else {
    // 引数で指定された場合、存在確認
    const exists = roles.find((r) => r.id === selectedRoleId);
    if (!exists) {
      console.log(`エラー: プロフィール設定 "${selectedRoleId}.profile.json" が見つかりません。`);
      process.exitCode = 1;
      return;
    }
  }

  // プロフィールのみ生成
  await generate(selectedRoleId, { profileOnly: true });

  console.log("\n=== 次のステップ ===\n");
  console.log("データベースに反映:");
  console.log("  pnpm db:push\n");

  return selectedRoleId;
}

// 直接実行された場合
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { positional, interactive, flags } = parseRoleOpsArgs(process.argv.slice(2), { flags: ["all"] });
    if (positional && flags.has("all")) throw new Error("<roleId> と --all は同時に指定できません");
    generateProfile(positional, { interactive, all: flags.has("all") }).catch((err) => {
      console.error("エラー:", err.message);
      process.exit(1);
    });
  } catch (err) {
    failUsage(err.message, USAGE);
  }
}
