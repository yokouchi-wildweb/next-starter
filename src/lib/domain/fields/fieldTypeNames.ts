// src/lib/domain/fields/fieldTypeNames.ts
// 型の名前の union(型だけ)。名前の正は表(fieldTypes.mjs・fieldFormInputs.mjs・formInputs.mjs)で、ここはそこから導くだけ。
// 名前を手で並べた union を別に書かない(CLAUDE.md field_types)。表に行を足せばここも広がる

import type { FIELD_TYPES } from "./fieldTypes.mjs";
import type { FORM_INPUTS } from "./fieldFormInputs.mjs";
import type { BUILTIN_FORM_INPUTS } from "./formInputs.mjs";

/** 表(fieldTypes.mjs)にある fieldType の名前(どの DB のものも、廃止した型も含む) */
export type FieldTypeName = keyof typeof FIELD_TYPES;

/** Neon(PostgreSQL)のドメインで使える fieldType(fieldFormInputs.mjs の Neon の表のキー) */
export type NeonFieldType = keyof (typeof FORM_INPUTS)["Neon"];

/** Firestore のドメインで使える fieldType(fieldFormInputs.mjs の Firestore の表のキー) */
export type FirestoreFieldType = keyof (typeof FORM_INPUTS)["Firestore"];

/** 組み込みの入力種別(entity.json formInput。formInputs.mjs) */
export type BuiltinFormInput = (typeof BUILTIN_FORM_INPUTS)[number];
