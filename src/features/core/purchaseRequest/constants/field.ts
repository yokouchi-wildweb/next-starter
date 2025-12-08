// src/features/purchaseRequest/constants/field.ts

// このファイルは domain-config スクリプトによって自動生成されています。
// 手動での編集は変更が上書きされる可能性があるため推奨されません。

export const PurchaseRequestWalletTypeOptions = [
  { value: "regular_point", label: "通常ポイント" },
  { value: "temporary_point", label: "期間限定ポイント" },
  { value: "regular_coin", label: "通常コイン" }
] as const;

export const PurchaseRequestPaymentMethodOptions = [
  { value: "credit_card", label: "クレジットカード" },
  { value: "amazon_pay", label: "Amazon Pay" },
  { value: "convenience_store", label: "コンビニ決済" },
  { value: "bank_transfer", label: "銀行振込" }
] as const;

export const PurchaseRequestStatusOptions = [
  { value: "pending", label: "処理待ち" },
  { value: "processing", label: "処理中" },
  { value: "completed", label: "完了" },
  { value: "failed", label: "失敗" },
  { value: "expired", label: "期限切れ" }
] as const;
