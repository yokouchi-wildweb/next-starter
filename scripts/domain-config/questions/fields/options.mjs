// フィールドの質問のうち「選択肢（options）」の部分。select / radio / checkbox / enum / array の値とラベルを聞く

import inquirer from "inquirer";

const prompt = inquirer.createPromptModule();

const NUMERIC_FIELD_TYPES = new Set(["number", "integer", "float", "bigint", "numeric(10,2)"]);

export function isNumericFieldType(fieldType) {
  return NUMERIC_FIELD_TYPES.has(fieldType);
}

function parseOptionValue(input, parseValue) {
  const trimmed = input.trim();
  let normalized = trimmed;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    normalized = trimmed.slice(1, -1);
  }
  if (parseValue) {
    return parseValue(normalized);
  }
  return normalized;
}

function createNumericOptionParser() {
  return (value) => {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      throw new Error("数値フィールドでは選択肢に数値を入力してください。例: 1, 2, 10.5");
    }
    return numericValue;
  };
}

/** 値とラベルの組を、空入力まで繰り返し聞く */
async function askOptions(parseValue) {
  const options = [];
  while (true) {
    const { value } = await prompt({
      type: "input",
      name: "value",
      message:
        options.length === 0 ? "選択肢として保存する値（例: apple。空で終了）:" : "次の選択肢として保存する値（例: apple。空で終了）:",
    });
    if (!value.trim()) break;
    let parsedValue;
    try {
      parsedValue = parseOptionValue(value, parseValue);
    } catch (error) {
      const message = error instanceof Error ? error.message : "選択肢の値が不正です。";
      console.log(message);
      continue;
    }
    const { label } = await prompt({
      type: "input",
      name: "label",
      message: `値 ${value} が画面に表示されるラベル（例: りんご）:`,
    });
    const trimmedLabel = label.trim() || value.trim();
    options.push({ value: parsedValue, label: trimmedLabel });
  }
  return options;
}

/**
 * 型と入力種別から選択肢が要るかを判定し、要るときだけ聞く（真偽値は「はい」「いいえ」を自動設定）。
 * @returns {Promise<Array<{ value: unknown, label: string }> | undefined>}
 */
export async function askFieldOptions({ fieldType, normalizedInput }) {
  const isBooleanField = fieldType === "boolean";
  const isArrayField = fieldType === "array" || fieldType === "stringArray";
  const isEnumField = fieldType === "enum";
  const isNumericField = isNumericFieldType(fieldType);

  const needsOptions =
    isBooleanField ||
    isArrayField ||
    isEnumField ||
    normalizedInput === "radio" ||
    normalizedInput === "select" ||
    (normalizedInput === "checkbox" && !isBooleanField);
  if (!needsOptions) return undefined;

  if (isBooleanField) {
    console.log("真偽値フィールドのため、選択肢は自動的に「はい」「いいえ」が設定されます。");
    return [
      { value: true, label: "はい" },
      { value: false, label: "いいえ" },
    ];
  }

  const optionValueParser = isNumericField ? createNumericOptionParser() : undefined;
  const guidance = isArrayField
    ? "配列フィールドで選択可能な値を入力してください。空欄で入力終了。値は文字列として保存されます。"
    : isNumericField
      ? "選択肢を入力してください。空欄で入力終了。値は数値として扱われます。"
      : "選択肢を入力してください。空欄で入力終了。値は文字列として扱われます。";
  console.log(guidance);
  let options;
  do {
    options = await askOptions(optionValueParser);
    if (!options.length && isArrayField) {
      console.log("配列フィールドには少なくとも1つの選択肢が必要です。");
    }
    if (!options.length && isEnumField) {
      console.log("Enum フィールドには少なくとも1つの選択肢が必要です。");
    }
  } while (!options.length && (isArrayField || isEnumField));
  return options;
}
