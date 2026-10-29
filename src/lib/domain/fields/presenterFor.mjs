// src/lib/domain/fields/presenterFor.mjs
// domain.json の項目を「何で表示するか」（一覧・詳細のフォーマッタの種類）を決める。答えは型の表（fieldTypes.mjs）と項目の formInput から導く。
// 読み手: 生成器（scripts/domain-config/render/presenters。答えを presenters.ts の式に写す）。
// 手書きの presenters.ts の項目は、この答えより優先される（生成後に手で書き換えた項目はそのまま）。
// .mjs なのは、tsx を通さない生成器（node）からも TypeScript からも import できるようにするため（fieldTypes.mjs と同じ）。

import { isCollectionFieldType, isMediaFieldType, presenterKind } from "./fieldTypes.mjs";

/**
 * @typedef {"boolean" | "number" | "stringArray" | "enum" | "string" | "datetime" | "date" | "collectionThumbnails" | "mediaThumbnail"} PresenterKind
 */

/**
 * @typedef {object} PresenterSpec
 * @property {PresenterKind} kind 表示の種類
 * @property {Array<{ value: string | number | boolean, label?: string }>} [options] kind "enum" のときの選択肢（値 → ラベル）
 */

/**
 * 項目の表示の種類。順: 表の presenter（boolean・number・stringArray・enum。enum は選択肢が無ければ文字列で確定）
 * → formInput（数値・文字列・日時・日付）→ 主の集まり → メディア → 文字列
 * @param {{ fieldType?: string, formInput?: string, options?: Array<{ value: string | number | boolean, label?: string }> }} field
 * @returns {PresenterSpec}
 */
export function presenterFor(field) {
  const { fieldType, formInput, options } = field;
  switch (presenterKind(fieldType)) {
    case "boolean":
      return { kind: "boolean" };
    case "number":
      return { kind: "number" };
    case "stringArray":
      return { kind: "stringArray" };
    case "enum":
      if (Array.isArray(options) && options.length) return { kind: "enum", options };
      return { kind: "string" };
    default:
      break;
  }
  if (formInput === "numberInput" || formInput === "stepperInput") return { kind: "number" };
  if (formInput === "textarea" || formInput === "textInput") return { kind: "string" };
  if (formInput === "datetimeInput") return { kind: "datetime" };
  if (formInput === "dateInput") return { kind: "date" };
  // メディア列: 値（storage ref・旧 URL）をサムネイルで表示する。主の集まりは先頭 1 件と +N
  if (isCollectionFieldType(fieldType)) return { kind: "collectionThumbnails" };
  if (isMediaFieldType(fieldType) || formInput === "mediaUploader" || formInput === "fileUploader") {
    return { kind: "mediaThumbnail" };
  }
  return { kind: "string" };
}
