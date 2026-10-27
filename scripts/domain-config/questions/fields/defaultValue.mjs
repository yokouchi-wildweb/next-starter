// フィールドの質問のうち「デフォルト値」の部分。型に応じて選択式・真偽・数値・文字列で聞く

import inquirer from "inquirer";
import { allowsDefaultValue, isNumericFieldType } from "../../spec/fieldTypes.mjs";

const prompt = inquirer.createPromptModule();

export async function askDefaultValue(fieldType, options) {
  // 対象外のフィールドタイプはスキップ
  if (!allowsDefaultValue(fieldType)) {
    return undefined;
  }

  const isNumericField = isNumericFieldType(fieldType);
  const isBooleanField = fieldType === "boolean";
  const isEnumField = fieldType === "enum";

  // enum: 選択式
  if (isEnumField && options && options.length > 0) {
    const choices = [
      { name: "(設定しない)", value: "__SKIP__" },
      ...options.map((opt) => ({ name: `${opt.label} (${opt.value})`, value: opt.value })),
    ];
    const { defaultValue } = await prompt({
      type: "list",
      name: "defaultValue",
      message: "デフォルト値を選択（設定しない場合は最初の項目）:",
      choices,
    });
    return defaultValue === "__SKIP__" ? undefined : defaultValue;
  }

  // boolean: true/false のみ許可
  if (isBooleanField) {
    const { defaultValue } = await prompt({
      type: "list",
      name: "defaultValue",
      message: "デフォルト値を選択:",
      choices: [
        { name: "(設定しない)", value: "__SKIP__" },
        { name: "true", value: true },
        { name: "false", value: false },
      ],
    });
    return defaultValue === "__SKIP__" ? undefined : defaultValue;
  }

  // 数値: Number() 変換
  if (isNumericField) {
    while (true) {
      const { defaultValue } = await prompt({
        type: "input",
        name: "defaultValue",
        message: "デフォルト値（空でスキップ）:",
      });
      const trimmed = defaultValue.trim();
      if (!trimmed) return undefined;
      const numericValue = Number(trimmed);
      if (Number.isNaN(numericValue)) {
        console.log("数値を入力してください。");
        continue;
      }
      return numericValue;
    }
  }

  // 文字列: そのまま
  const { defaultValue } = await prompt({
    type: "input",
    name: "defaultValue",
    message: "デフォルト値（空でスキップ）:",
  });
  const trimmed = defaultValue.trim();
  return trimmed || undefined;
}
