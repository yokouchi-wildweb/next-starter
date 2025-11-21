// src/features/sample/types/field.ts

// このファイルは domain-config スクリプトによって自動生成されています。
// 手動での編集は変更が上書きされる可能性があるため推奨されません。

type FieldConstants = typeof import("../constants/field");

export type SampleRadioOption = FieldConstants["SampleRadioOptions"][number];
export type SampleRadioValue = SampleRadioOption["value"];
export type SampleRadioLabel = SampleRadioOption["label"];

export type SampleSelectOption = FieldConstants["SampleSelectOptions"][number];
export type SampleSelectValue = SampleSelectOption["value"];
export type SampleSelectLabel = SampleSelectOption["label"];
