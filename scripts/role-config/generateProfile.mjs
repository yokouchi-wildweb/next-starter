#!/usr/bin/env node
// scripts/role-config/generateProfile.mjs
// 既存のプロフィール設定に対して生成処理のみを実行するスクリプト

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import generate from "./generate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const PROFILES_DIR = path.join(ROOT_DIR, "src/features/core/userProfile/profiles");
const ROLES_DIR = path.join(ROOT_DIR, "src/features/core/user/roles");

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
    let isCore = false;
    const rolePath = path.join(ROLES_DIR, `${roleId}.role.json`);
    const coreRolePath = path.join(ROLES_DIR, `_${roleId}.role.json`);

    if (fs.existsSync(rolePath)) {
      const roleConfig = JSON.parse(fs.readFileSync(rolePath, "utf-8"));
      roleLabel = roleConfig.label || roleId;
      isCore = roleConfig.isCore || false;
    } else if (fs.existsSync(coreRolePath)) {
      const roleConfig = JSON.parse(fs.readFileSync(coreRolePath, "utf-8"));
      roleLabel = roleConfig.label || roleId;
      isCore = true;
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
export default async function generateProfile(roleIdArg) {
  console.log("\n=== プロフィール生成 ===\n");

  // プロフィール設定があるロールを取得
  const roles = getRolesWithProfile();

  if (roles.length === 0) {
    console.log("プロフィール設定が見つかりません。先に prof:add でプロフィールを作成してください。");
    return;
  }

  let selectedRoleId = roleIdArg;

  // 引数がない場合は選択
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
      return;
    }
  }

  // プロフィールのみ生成
  await generate(selectedRoleId, { profileOnly: true });

  console.log("\n=== 次のステップ ===\n");
  console.log("データベースに反映:");
  console.log("  pnpm drizzle-kit push\n");

  return selectedRoleId;
}

// 直接実行された場合
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const roleId = process.argv[2];

  generateProfile(roleId).catch((err) => {
    console.error("エラー:", err.message);
    process.exit(1);
  });
}
