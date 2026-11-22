// src/lib/formSuite/Field/types.ts
// フィールド設定の型定義。domain.json の項目のキーは @/lib/domain の DomainField が持ち、ここは画面でだけ使う分を広げる

import type { ComponentType, ReactNode } from "react";
import type { ControllerRenderProps } from "react-hook-form";
import type { FileValidationRule, SelectedMediaMetadata } from "@/lib/mediaInputSuite";
import type { FormControlA11yProps } from "@/components/Input/options";
import type { ParaProps } from "@/components/TextBlocks/Para";
import type { BuiltinFormInput, DomainField, DomainFieldOption } from "@/lib/domain";

/** 登録された入力部品の名前（src/wiring/formInputs/FormInputsRoot.tsx が一覧の鍵から広げる） */
export interface RegisteredFormInputs {}

/** 登録の部品が受ける props（id・aria-* は FormControl が渡す。入力部品へそのまま渡すとラベルと結び付く） */
export type FormInputProps = {
  field: ControllerRenderProps<any, any>;
  fieldConfig: FieldConfig;
  inputClassName?: string;
} & FormControlA11yProps;

/** 入力部品の登録の項目（src/wiring/formInputs/inputs/ の export const formInput） */
export type FormInputItem = {
  readonly name: string;
  /** 部品の本体（default export） */
  readonly load: () => Promise<{ default: ComponentType<FormInputProps> }>;
  /** 共通の枠（ラベル・必須印・説明）を描くか（既定 true）。false でもエラーの表示は残る */
  readonly frame?: boolean;
  /** 自動保存の blur の扱い（既定 "none" = 保存しない） */
  readonly blurMode?: "immediate" | "debounce" | "none";
};

/**
 * MediaUploader 用バリデーションルール
 * mediaUploaderMulti では minItems / maxItems も使用される
 */
export type MediaValidationRule = FileValidationRule & {
  /** 最小件数（mediaUploaderMulti用） */
  minItems?: number;
  /** 最大件数（mediaUploaderMulti用、既定 10） */
  maxItems?: number;
};

/**
 * 欄の設定 = domain.json の項目(DomainField、@/lib/domain)を画面用に広げた物。
 * - domain.json に書けるキーは DomainField のまま(キーを写し直さない)
 * - fieldType は省ける(画面で手で組む設定は型を書かないことがある。domain.json では必須)
 * - 狭める物: formInput(組み込み + 登録した入力部品の名前)・options(値の型が決まった選択肢)・mediaTypePreset・validationRule(メディアの形)
 * - 足す物(画面でだけ使う値): purpose・onMetadataChange・async*
 * @see src/domains/README.md - Field（フィールド定義）
 */
export type FieldConfig = Omit<DomainField, "fieldType" | "formInput" | "options" | "mediaTypePreset" | "validationRule"> & {
  /** データ型(表 fieldTypes.mjs の名前。手で組む設定では省ける) */
  fieldType?: DomainField["fieldType"];
  /** フォーム入力種別(組み込みの名前か、src/wiring/formInputs に登録した名前) */
  formInput: BuiltinFormInput | keyof RegisteredFormInputs;
  /** 選択肢（select, radio, checkbox, multiSelect で使用） */
  options?: readonly DomainFieldOption[];
  /** 許可ファイル種別 */
  mediaTypePreset?: "images" | "videos" | "imagesAndVideos" | "all";
  /** バリデーション設定(メディアの項目の形) */
  validationRule?: MediaValidationRule;
  /** ファイルの用途 ID（`<domain>.<field>`。src/registry/storagePurposeRegistry.ts の登録名。生成 Fields コンポーネントが付ける） */
  purpose?: string;
  /** メタデータ変更時のコールバック（mediaUploader用） */
  onMetadataChange?: (metadata: SelectedMediaMetadata) => void;

  // === 非同期リレーション用メタデータ（ランタイム専用） ===
  /** リレーション先 API パス（例: "/api/sampleCategory"） */
  asyncApiPath?: string;
  /** リレーション先のラベルに使うフィールド名（デフォルト: "name"） */
  asyncLabelField?: string;
  /** リレーション先の検索対象フィールド */
  asyncSearchFields?: string[];
};

// ============================================
// フィールドコンポーネント共通Props
// ============================================

/**
 * 説明テキストの設定
 */
export type FieldItemDescription = {
  /** 説明テキスト */
  text: ReactNode;
  /** テキストのトーン */
  tone?: ParaProps["tone"];
  /** テキストのサイズ */
  size?: ParaProps["size"];
  /** 表示位置（入力の前 or 後） */
  placement?: "before" | "after";
};

/**
 * フィールドレイアウトの設定
 */
export type FieldLayoutOptions = {
  /** レイアウト方向（デフォルト: "vertical"） */
  layout?: "vertical" | "horizontal" | "responsive";
  /** ラベルに適用するクラス名（例: "w-[120px]", "text-lg font-bold"） */
  labelClass?: string;
};

/**
 * フィールド表示の共通オプション
 */
export type FieldDisplayOptions = FieldLayoutOptions & {
  /** FormItem全体に適用するクラス名 */
  className?: string;
  /** 内部のInputコンポーネントに適用するクラス名 */
  inputClassName?: string;
  /** ラベルを視覚的に非表示にする */
  hideLabel?: boolean;
  /** エラーメッセージを非表示にする */
  hideError?: boolean;
};

/**
 * 必須マーク関連の共通オプション
 */
export type RequiredMarkOptions = {
  /** フィールドが必須かどうか */
  required?: boolean;
  /** カスタム必須マーク（省略時はデフォルトの赤い * を表示） */
  requiredMark?: ReactNode;
  /** 必須マークの位置（デフォルト: "after"） */
  requiredMarkPosition?: "before" | "after";
};

/**
 * フィールド共通Props（表示 + 必須マーク + 説明）
 * ControlledField, ControlledMediaField, ConfiguredField 等で共通使用
 */
export type FieldCommonProps = FieldDisplayOptions & RequiredMarkOptions & {
  /** 説明テキスト */
  description?: FieldItemDescription;
};
