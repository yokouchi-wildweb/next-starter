// src/components/Input/options/types.ts

import { type AriaAttributes, type ReactNode } from "react";

/**
 * Select や Radio などの選択肢で共有する値の型。
 * メニュー／フォーム問わず共通で利用できるリテラル型を意図している。
 */
export type OptionValue = string | number | boolean;

/**
 * 選択肢の表示ラベルと値。複数の UI コンポーネントで共有する構造。
 */
export type Options = {
  label: ReactNode;
  value: OptionValue;
  /** タグ等で色付き表示する場合のカラーキー */
  color?: string;
  /**
   * 表示はするが選択できない選択肢（使用中・在庫切れ・権限なし等）。
   * 既に選択済みの値は選択されたまま残り、この項目からは解除もできない。
   * UX 用の表示制御のみで、値の検証は行わない（サーバー側で別途ガードすること）。
   */
  disabled?: boolean;
};

/**
 * 選択肢を扱う入力部品で共有する選択肢のプリミティブ値。
 */
export type OptionPrimitive = Options["value"];

/**
 * 欄の枠(formSuite の FormControl)が入力へ渡す 3 つ。入力部品は受けて、フォーカスされる要素
 * (input・トリガーのボタン。選択肢の組は role="group" / "radiogroup" の入れ物)へ付ける。
 * ラベルの for・説明文・エラーがこれで入力と結び付く(検査: pnpm test src/lib/formSuite/a11yContract.test.tsx)
 */
export type FormControlA11yProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
};
