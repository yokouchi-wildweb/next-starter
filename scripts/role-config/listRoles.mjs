#!/usr/bin/env node
// scripts/role-config/listRoles.mjs
// ロール一覧を表示するスクリプト

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const ROLES_DIR = path.join(ROOT_DIR, "src/features/core/user/roles");
const PROFILES_DIR = path.join(
  ROOT_DIR,
  "src/features/core/userProfile/profiles"
);

/**
 * ロール情報を取得
 */
function getRoles() {
  if (!fs.existsSync(ROLES_DIR)) {
    return [];
  }

  const files = fs.readdirSync(ROLES_DIR);
  return files
    .filter((file) => file.endsWith(".role.json"))
    .map((file) => {
      const filePath = path.join(ROLES_DIR, file);
      const config = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const isCore = file.startsWith("_") || config.isCore;

      // プロフィール設定の確認
      let profileFieldCount = null;
      const profilePath = path.join(PROFILES_DIR, `${config.id}.profile.json`);
      if (fs.existsSync(profilePath)) {
        const profileConfig = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
        profileFieldCount = profileConfig.fields?.length || 0;
      }

      return {
        id: config.id,
        label: config.label,
        category: config.category || "-",
        description: config.description || "-",
        hasProfile: config.hasProfile,
        profileFieldCount,
        isCore,
      };
    })
    .sort((a, b) => {
      // コアロールを先に、その後はカテゴリ順、ID順
      if (a.isCore !== b.isCore) return a.isCore ? -1 : 1;
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.id.localeCompare(b.id);
    });
}

/**
 * 文字列を指定幅にパディング（日本語対応）
 */
function pad(str, len) {
  const strLen = [...str].length;
  if (strLen >= len) return str;
  return str + " ".repeat(len - strLen);
}

/**
 * メイン処理
 */
function listRoles() {
  console.log("\n=== ロール一覧 ===\n");

  const roles = getRoles();

  if (roles.length === 0) {
    console.log("ロール設定が見つかりません。");
    return;
  }

  // ID幅を動的に計算
  const maxIdLen = Math.max(...roles.map((r) => r.id.length), 8);

  for (const role of roles) {
    const tags = [];

    // カテゴリ
    tags.push(`[${role.category}]`);

    // コアフラグ
    if (role.isCore) tags.push("[コア]");

    // プロフィール
    if (role.profileFieldCount !== null) {
      tags.push(`[Profile:${role.profileFieldCount}]`);
    } else if (role.hasProfile) {
      tags.push("[Profile:未生成]");
    }

    const line = `• ${pad(role.id, maxIdLen)}  ${role.label}  ${tags.join("")}`;
    console.log(line);
  }

  console.log(`\n合計: ${roles.length} ロール\n`);
}

// 実行
listRoles();
