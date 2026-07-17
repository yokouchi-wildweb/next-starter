// src/features/core/user/entities/userName.ts

import { USER_NAME_CONFIG } from "@/config/app/user-name.config";
import { z } from "zod";

/**
 * 表示名に使用できない文字。
 * - Cc: 制御文字 (改行・タブ等) / Cf: 書式文字 (ゼロ幅スペース等の不可視文字)
 * - Zl / Zp: 行区切り・段落区切り
 */
const USER_NAME_FORBIDDEN_CHARS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

const USER_NAME_MAX_LENGTH_RULE = {
  limit: USER_NAME_CONFIG.maxLength,
  message: `表示名は${USER_NAME_CONFIG.maxLength}文字以内で入力してください`,
} as const;

const USER_NAME_CHARS_RULE = {
  check: (value: string) => !USER_NAME_FORBIDDEN_CHARS.test(value),
  message: "表示名に改行や制御文字などの使用できない文字が含まれています",
} as const;

/**
 * 表示名の共有スキーマ (必須)。
 * サインアップ (RegistrationSchema)・本登録 (UserActivationSchema) など
 * 表示名が必須の経路はすべてこのスキーマを使うこと。
 * 文字数上限は USER_NAME_CONFIG.maxLength で調整する。
 */
export const UserNameSchema = z
  .string({ required_error: "表示名を入力してください" })
  .trim()
  .min(1, { message: "表示名を入力してください" })
  .max(USER_NAME_MAX_LENGTH_RULE.limit, { message: USER_NAME_MAX_LENGTH_RULE.message })
  .refine(USER_NAME_CHARS_RULE.check, { message: USER_NAME_CHARS_RULE.message });

/**
 * 表示名の共有スキーマ (null 許容)。
 * 空文字・空白のみは null (未設定/クリア) に正規化し、値がある場合は同じ制約を課す。
 * UserCoreSchema.name などエンティティ側の任意フィールドで使う。
 */
export const UserNameNullishSchema = z
  .string()
  .trim()
  .max(USER_NAME_MAX_LENGTH_RULE.limit, { message: USER_NAME_MAX_LENGTH_RULE.message })
  .refine(USER_NAME_CHARS_RULE.check, { message: USER_NAME_CHARS_RULE.message })
  .nullish()
  .transform((value) => (value === "" ? null : value));

/**
 * フォーム入力用の表示名スキーマ (空文字 = 未設定/クリアを許容)。
 * react-hook-form は空欄を空文字で扱うため、null 変換をせず文字列のまま検証する。
 * 表示名を必須にするフォームは UserNameSchema を使うこと。
 */
export const UserNameFormSchema = z
  .string()
  .trim()
  .max(USER_NAME_MAX_LENGTH_RULE.limit, { message: USER_NAME_MAX_LENGTH_RULE.message })
  .refine(USER_NAME_CHARS_RULE.check, { message: USER_NAME_CHARS_RULE.message });
