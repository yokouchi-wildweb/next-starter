// src/features/core/wallet/constants/metaFields.ts

export type WalletMetaFieldInputType = "textInput" | "textarea";

type WalletMetaFieldConfig = {
  name: string;
  label: string;
  formInput: WalletMetaFieldInputType;
  placeholder?: string;
  description?: string;
  maxLength?: number;
  rows?: number;
};

export const walletMetaFieldDefinitions = [
  {
    name: "productId",
    label: "商品ID",
    formInput: "textInput",
    placeholder: "例: ITEM-001",
    description: "対象の商品・アイテムなどがあれば入力してください。",
  },
  {
    name: "orderId",
    label: "注文ID",
    formInput: "textInput",
    placeholder: "例: ORDER-2024-0001",
  },
  {
    name: "notes",
    label: "メモ",
    formInput: "textarea",
    placeholder: "社内メモや共有事項",
    rows: 2,
  },
] as const satisfies readonly WalletMetaFieldConfig[];

export type WalletMetaFieldDefinition = (typeof walletMetaFieldDefinitions)[number];
export type WalletMetaFieldName = WalletMetaFieldDefinition["name"];
