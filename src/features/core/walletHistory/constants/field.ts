// src/features/walletHistory/constants/field.ts

// このファイルは domain-config スクリプトによって自動生成されています。
// 手動での編集は変更が上書きされる可能性があるため推奨されません。

// WalletTypeOptions は wallet ドメインから再利用
export { WalletTypeOptions as WalletHistoryTypeOptions } from "@/features/core/wallet/constants/field";

export const WalletHistoryChangeMethodOptions = [
  { value: "INCREMENT", label: "増加" },
  { value: "DECREMENT", label: "減少" },
  { value: "SET", label: "残高セット" }
] as const;

export const WalletHistorySourceTypeOptions = [
  { value: "user_action", label: "ユーザー操作" },
  { value: "admin_action", label: "管理者操作" },
  { value: "system", label: "システム" }
] as const;
