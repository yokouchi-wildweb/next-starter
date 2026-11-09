// src/features/core/wallet/utils/currency.ts
// 通貨設定に関するユーティリティ関数

import { walletConfig, type WalletType } from "@/features/wallet/config";
import type { CurrencyConfig, CurrencyMetaFieldConfig } from "../types/currency";

/**
 * 有効なスラッグの一覧
 */
export const VALID_SLUGS = Object.values(walletConfig.currency).map((c) => c.slug) as string[];

/**
 * 有効な walletType の一覧
 */
export const VALID_WALLET_TYPES = Object.keys(walletConfig.currency) as WalletType[];

/**
 * スラッグが有効かどうかを判定
 */
export function isValidSlug(slug: string): boolean {
  return VALID_SLUGS.includes(slug);
}

/**
 * 任意の値が有効な walletType かどうかを判定（型ガード）
 */
export function isWalletType(value: unknown): value is WalletType {
  return typeof value === "string" && (VALID_WALLET_TYPES as string[]).includes(value);
}

/**
 * スラッグから walletType を取得
 */
export function getWalletTypeBySlug(slug: string): WalletType | null {
  const entry = Object.entries(walletConfig.currency).find(
    ([, config]) => config.slug === slug
  );
  return entry ? (entry[0] as WalletType) : null;
}

/**
 * スラッグから通貨設定を取得
 */
export function getCurrencyConfigBySlug(
  slug: string
): (CurrencyConfig & { walletType: WalletType }) | null {
  const walletType = getWalletTypeBySlug(slug);
  if (!walletType) return null;
  return {
    ...walletConfig.currency[walletType],
    walletType,
  };
}

/**
 * walletType から通貨設定を取得
 */
export function getCurrencyConfig(
  walletType: WalletType
): CurrencyConfig & { walletType: WalletType } {
  return {
    ...walletConfig.currency[walletType],
    walletType,
  };
}

/**
 * walletType から slug を取得
 */
export function getSlugByWalletType(walletType: WalletType): string {
  return walletConfig.currency[walletType].slug;
}

/**
 * walletType からメタフィールド定義を取得
 */
export function getMetaFieldsByWalletType(walletType: WalletType): readonly CurrencyMetaFieldConfig[] {
  return walletConfig.currency[walletType].metaFields;
}

/**
 * walletType からメタフィールド名の一覧を取得
 */
export function getMetaFieldNamesByWalletType(walletType: WalletType): string[] {
  return walletConfig.currency[walletType].metaFields.map((field) => field.name);
}

/**
 * 全ウォレット種別のメタフィールドをユニークに結合
 * フォームスキーマ生成用（全種別のフィールドを含む必要がある）
 */
export function getAllMetaFields(): CurrencyMetaFieldConfig[] {
  const allFields: CurrencyMetaFieldConfig[] = [];

  Object.values(walletConfig.currency).forEach((config) => {
    config.metaFields.forEach((field) => {
      allFields.push(field as CurrencyMetaFieldConfig);
    });
  });

  const uniqueFields = new Map<string, CurrencyMetaFieldConfig>();
  allFields.forEach((field) => {
    if (!uniqueFields.has(field.name)) {
      uniqueFields.set(field.name, field);
    }
  });

  return Array.from(uniqueFields.values());
}

/**
 * 全ウォレット種別のメタフィールド名をユニークに取得
 */
export function getAllMetaFieldNames(): string[] {
  return getAllMetaFields().map((field) => field.name);
}

/**
 * メタフィールド名からラベルを取得するマップを生成
 */
export function getMetaFieldLabelMap(): Map<string, string> {
  const allFields = getAllMetaFields();
  return new Map(allFields.map((field) => [field.name, field.label]));
}
