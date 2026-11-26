// src/domains/core/purchaseRequest/types/purchaseRequestField.ts

// このファイルは domain-config スクリプトによって自動生成されています。
// 手動での編集は変更が上書きされる可能性があるため推奨されません。

type FieldConstants = typeof import("../constants/purchaseRequestField");

export type PurchaseRequestWalletTypeOption = FieldConstants["PurchaseRequestWalletTypeOptions"][number];
export type PurchaseRequestWalletTypeValue = PurchaseRequestWalletTypeOption["value"];
export type PurchaseRequestWalletTypeLabel = PurchaseRequestWalletTypeOption["label"];

export type PurchaseRequestPaymentMethodOption = FieldConstants["PurchaseRequestPaymentMethodOptions"][number];
export type PurchaseRequestPaymentMethodValue = PurchaseRequestPaymentMethodOption["value"];
export type PurchaseRequestPaymentMethodLabel = PurchaseRequestPaymentMethodOption["label"];

export type PurchaseRequestStatusOption = FieldConstants["PurchaseRequestStatusOptions"][number];
export type PurchaseRequestStatusValue = PurchaseRequestStatusOption["value"];
export type PurchaseRequestStatusLabel = PurchaseRequestStatusOption["label"];
