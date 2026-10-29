// src/components/Form/Field/Configured/checkGroupFieldTypes.ts
// formInput "checkbox" を複数選択（CheckGroupInput）にする fieldType の判定。答えは型の表
// （src/lib/domain/fields/fieldTypes.mjs の array 属性）が持ち、ここは import 先を保つための再 export

export { isCheckGroupFieldType } from "@/lib/domain/fields/fieldTypes.mjs";
