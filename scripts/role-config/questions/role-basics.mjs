// scripts/role-config/questions/role-basics.mjs
// ロール基本設定の収集

import inquirer from "inquirer";
import { toSnakeCase } from "../../../src/utils/stringCase.mjs";

const prompt = inquirer.createPromptModule();

/**
 * ロールID の入力
 */
async function askRoleId() {
  const { id } = await prompt({
    type: "input",
    name: "id",
    message: "ロールID（snake_case、例: reviewer）:",
    validate: (input) => {
      const trimmed = input.trim();
      if (!trimmed) return "ロールIDは必須です";
      if (/^_/.test(trimmed)) return "_ プレフィックスはコアロール専用です";
      if (!/^[a-z][a-z0-9_]*$/.test(trimmed))
        return "ロールIDは snake_case で入力してください（例: reviewer, content_editor）";
      return true;
    },
  });
  return toSnakeCase(id.trim());
}

/**
 * ラベル（表示名）の入力
 */
async function askLabel(roleId) {
  const { label } = await prompt({
    type: "input",
    name: "label",
    message: `表示名（例: レビュアー） [${roleId}]:`,
    default: roleId,
  });
  return label.trim() || roleId;
}

/**
 * カテゴリの選択
 */
async function askCategory() {
  const { category } = await prompt({
    type: "list",
    name: "category",
    message: "ロールカテゴリ:",
    choices: [
      { name: "user - 一般ユーザー向け", value: "user" },
      { name: "admin - 管理者向け", value: "admin" },
    ],
    default: "user",
  });
  return category;
}

/**
 * 説明文の入力
 */
async function askDescription() {
  const { description } = await prompt({
    type: "input",
    name: "description",
    message: "説明文（例: コンテンツをレビューできる）:",
  });
  return description.trim();
}

/**
 * プロフィール有無の確認
 */
async function askHasProfile() {
  const { hasProfile } = await prompt({
    type: "confirm",
    name: "hasProfile",
    message: "このロール専用のプロフィールテーブルを作成しますか？",
    default: false,
  });
  return hasProfile;
}

/**
 * ロール基本設定を収集
 * @returns {Promise<{id: string, label: string, category: string, description: string, hasProfile: boolean, isCore: false, enabled: true}>}
 */
export default async function askRoleBasics() {
  const id = await askRoleId();
  const label = await askLabel(id);
  const category = await askCategory();
  const description = await askDescription();
  const hasProfile = await askHasProfile();

  return {
    id,
    label,
    category,
    description,
    hasProfile,
    isCore: false,
    enabled: true,
  };
}
