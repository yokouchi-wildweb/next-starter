// src/features/notification/constants/field.ts

// このファイルは domain-config スクリプトによって自動生成されています。
// 手動での編集は変更が上書きされる可能性があるため推奨されません。

export const NotificationTargetTypeOptions = [
  { value: "all", label: "全員" },
  { value: "role", label: "ロール指定" },
  { value: "individual", label: "個別指定" }
] as const;

export const NotificationSenderTypeOptions = [
  { value: "admin", label: "管理者" },
  { value: "system", label: "システム" }
] as const;
