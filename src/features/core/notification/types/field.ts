// src/features/notification/types/field.ts

// このファイルは domain-config スクリプトによって自動生成されています。
// 手動での編集は変更が上書きされる可能性があるため推奨されません。

type FieldConstants = typeof import("../constants/field");

export type NotificationTargetTypeOption = FieldConstants["NotificationTargetTypeOptions"][number];
export type NotificationTargetTypeValue = NotificationTargetTypeOption["value"];
export type NotificationTargetTypeLabel = NotificationTargetTypeOption["label"];

export type NotificationSenderTypeOption = FieldConstants["NotificationSenderTypeOptions"][number];
export type NotificationSenderTypeValue = NotificationSenderTypeOption["value"];
export type NotificationSenderTypeLabel = NotificationSenderTypeOption["label"];
