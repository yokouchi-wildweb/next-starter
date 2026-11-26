// src/lib/domain/types/domainField.ts
// entity.json の項目(Field)1 つの型。キーの正は生成器の語彙 scripts/structure/domain/spec/domainJson.mjs の FIELD_KEYS
// (開発者のメモ $comment を除く)で、ここはその型の 1 か所。項目のキーを持つ型(DomainConfig の fields・DomainDisplayField・
// DomainFieldInfo、formSuite の FieldConfig、crud の表示の列の設定など)はここから Pick / 広げで作り、キーを写し直さない。
// 値は entity.json に書ける素の値だけ(関数・実行時だけの値・登録した入力部品の名前への広げは formSuite の FieldConfig が足す)。

import type { BuiltinFormInput, FieldTypeName } from "../fields/fieldTypeNames";

/** 選択肢 1 つ(画面で使う形) */
export type DomainFieldOption = {
  value: string | number | boolean;
  label: string;
  /** 表示はするが選べない選択肢 */
  disabled?: boolean;
};

/** entity.json に書いた選択肢(JSON のままなので値の型は決め打ちしない) */
export type DomainFieldOptionValue = {
  readonly value: unknown;
  readonly label?: string;
  readonly disabled?: boolean;
};

/** 主の集まり(fieldType mediaCollection)の項目の collection(キーは COLLECTION_KEYS) */
export type DomainFieldCollection = {
  /** 従属ドメインの singular */
  readonly domain: string;
  readonly maxItems?: number;
  /** 複製で写すか */
  readonly duplicate?: boolean;
};

/** entity.json の項目 1 つ */
export type DomainField = {
  /** 列名(snake_case) */
  name: string;
  /** 表示ラベル */
  label: string;
  /** 型(表 fieldTypes.mjs の名前。表に無い型も書ける = 生成器は未知型として扱う) */
  fieldType: FieldTypeName | (string & {});
  /** 入力種別(組み込みの名前か、<ドメイン か lib>/plugs/formInputs に登録した名前) */
  formInput?: BuiltinFormInput | (string & {});
  required?: boolean;
  readonly?: boolean;
  disabled?: boolean;
  /** 入力の初期値(型は項目ごとに違う) */
  defaultValue?: unknown;
  options?: readonly DomainFieldOptionValue[];
  /** radio / checkbox などの表示の形 */
  displayType?: string;
  placeholder?: string;
  /** メディアの項目のハンドラ識別子(camelCase) */
  slug?: string;
  /** メディアの項目の許可する種類(images / videos / imagesAndVideos / all。JSON から読むので素の文字列。名前の狭めは formSuite) */
  mediaTypePreset?: string;
  /** accept 属性値(例: image/*,video/*) */
  accept?: string;
  /** 確かめの設定(素の形。メディアの項目の形は formSuite が狭める) */
  validationRule?: Readonly<Record<string, unknown>>;
  /** 説明文(枠がラベルの下に描く) */
  helperText?: string;
  /**
   * メタデータを別の項目に保存する対応(メタデータのキー → 項目名)。キーはメディアの種類ごとに違い、どれも省ける。
   * Partial なのは、項目ごとに鍵の違う entity.json を JSON の import で読むと、TypeScript が他の項目の鍵を `?: undefined` で足すため
   */
  metadataBinding?: Readonly<Partial<Record<string, string>>>;
  /** 並び替え可否 */
  reorderable?: boolean;
  /** 値の重なりを許さない(生成器が一意の索引を作る) */
  unique?: boolean;
  /** メディアの保存の設定(生成器と server が読む。client の写しには出さない) */
  storage?: Readonly<Record<string, unknown>>;
  /** 主の集まりの設定(fieldType mediaCollection) */
  collection?: DomainFieldCollection;
};
