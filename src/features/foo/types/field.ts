// src/features/foo/types/field.ts

// このファイルは domain-config スクリプトによって自動生成されています。
// 手動での編集は変更が上書きされる可能性があるため推奨されません。

type FieldConstants = typeof import("../constants/field");

export type FooTypeOption = FieldConstants["FooTypeOptions"][number];
export type FooTypeValue = FooTypeOption["value"];
export type FooTypeLabel = FooTypeOption["label"];
