// src/components/Form/Field/Configured/checkGroupFieldTypes.ts
// formInput "checkbox" を複数選択（CheckGroupInput）にする fieldType。値が文字列の配列の型
// （生成器の型の表 scripts/domain-config/spec/fieldTypes.mjs で array: true のもの）。
// 抜けは src/components/Form/FieldRenderer/defaultValueBuilder.test.ts が表と突き合わせて検知する

const CHECK_GROUP_FIELD_TYPES: ReadonlySet<string> = new Set(["array", "stringArray"]);

export function isCheckGroupFieldType(fieldType: string | undefined): boolean {
  return fieldType !== undefined && CHECK_GROUP_FIELD_TYPES.has(fieldType);
}
