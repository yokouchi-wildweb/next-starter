import inquirer from 'inquirer';
import { FORM_INPUTS } from '../form-inputs.mjs';
import { toCamelCase, toSnakeCase } from '../../../src/utils/stringCase.mjs';
const prompt = inquirer.createPromptModule();

const NUMERIC_FIELD_TYPES = new Set(['number', 'integer', 'bigint', 'numeric(10,2)']);

function parseOptionValue(input, parseValue) {
  const trimmed = input.trim();
  let normalized = trimmed;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    normalized = trimmed.slice(1, -1);
  }
  if (parseValue) {
    return parseValue(normalized);
  }
  return normalized;
}

function isNumericFieldType(fieldType) {
  return NUMERIC_FIELD_TYPES.has(fieldType);
}

function createNumericOptionParser() {
  return (value) => {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      throw new Error('数値フィールドでは選択肢に数値を入力してください。例: 1, 2, 10.5');
    }
    return numericValue;
  };
}

async function askOptions(parseValue) {
  const options = [];
  while (true) {
    const { value } = await prompt({
      type: 'input',
      name: 'value',
      message:
        options.length === 0
          ? '選択肢として保存する値（例: apple。空で終了）:'
          : '次の選択肢として保存する値（例: apple。空で終了）:',
    });
    if (!value.trim()) break;
    let parsedValue;
    try {
      parsedValue = parseOptionValue(value, parseValue);
    } catch (error) {
      const message = error instanceof Error ? error.message : '選択肢の値が不正です。';
      console.log(message);
      continue;
    }
    const { label } = await prompt({
      type: 'input',
      name: 'label',
      message: `値 ${value} が画面に表示されるラベル（例: りんご）:`,
    });
    const trimmedLabel = label.trim() || value.trim();
    options.push({ value: parsedValue, label: trimmedLabel });
  }
  return options;
}

async function askSingleField(config) {
  const { name } = await prompt({
    type: 'input',
    name: 'name',
    message:
      config._fieldIndex === 0
        ? 'フィールド名（snake_case。空でスキップ）:'
        : 'フィールド名（snake_case。空で終了）:',
  });
  if (!name.trim()) return null;

  const { label } = await prompt({
    type: 'input',
    name: 'label',
    message: 'フィールド表示名:',
  });

  const trimmedName = toSnakeCase(name.trim());
  const trimmedLabel = label.trim() || trimmedName;

  const fieldTypes = Object.keys(FORM_INPUTS[config.dbEngine]);
  const { fieldType } = await prompt({
    type: 'list',
    name: 'fieldType',
    message: 'フィールドの型を選択:',
    choices: fieldTypes,
  });

  const formChoices = FORM_INPUTS[config.dbEngine][fieldType];
  const { formInput } = await prompt({
    type: 'list',
    name: 'formInput',
    message: 'フォーム入力種別を選択:',
    choices: formChoices,
  });
  const normalizedInput = toCamelCase(formInput);

  const isBooleanField = fieldType === 'boolean';
  const isArrayField = fieldType === 'array';
  const isEnumField = fieldType === 'enum';
  const isNumericField = isNumericFieldType(fieldType);

  let uploadPath;
  let slug;
  if (normalizedInput === 'imageUploader') {
    const domainSlug = toCamelCase(config.singular ?? '') || 'domain';
    const uploadExample = `${domainSlug}/main`;
    while (true) {
      const up = await prompt({
        type: 'input',
        name: 'uploadPath',
        message: `画像の保存パス（例: ${uploadExample}）:`,
      });
      uploadPath = up.uploadPath.trim();
      if (uploadPath) break;
      console.log('画像の保存パスは必須です。空で続行することはできません。');
    }
    const camelName = toCamelCase(trimmedName);
    const baseSlug = camelName
      .replace(/ImageUrl$/, '')
      .replace(/Url$/, '')
      .replace(/Image$/, '');
    const sl = await prompt({
      type: 'input',
      name: 'slug',
      message: '画像ハンドラ名用のスラッグ（camelCase、ハイフン不可）:',
      default: baseSlug,
    });
    slug = sl.slug.trim() || baseSlug;
  }

  let requiredAnswer = { required: false };
  if (isArrayField) {
    console.log('配列フィールドは未選択時に空配列を保存するため、必須設定はスキップします。');
  } else {
    requiredAnswer = await prompt({
      type: 'confirm',
      name: 'required',
      message: 'このフィールドを必須にしますか?',
      default: false,
    });
  }

  let options;
  const needsOptions =
    isBooleanField ||
    isArrayField ||
    isEnumField ||
    normalizedInput === 'radio' ||
    normalizedInput === 'select' ||
    (normalizedInput === 'checkbox' && !isBooleanField);

  if (needsOptions) {
    if (isBooleanField) {
      console.log('真偽値フィールドのため、選択肢は自動的に「はい」「いいえ」が設定されます。');
      options = [
        { value: true, label: 'はい' },
        { value: false, label: 'いいえ' },
      ];
    } else {
      const optionValueParser = isNumericField ? createNumericOptionParser() : undefined;
      const guidance =
        isArrayField
          ? '配列フィールドで選択可能な値を入力してください。空欄で入力終了。値は文字列として保存されます。'
          : isNumericField
              ? '選択肢を入力してください。空欄で入力終了。値は数値として扱われます。'
              : '選択肢を入力してください。空欄で入力終了。値は文字列として扱われます。';
      console.log(guidance);
      do {
        options = await askOptions(optionValueParser);
        if (!options.length && isArrayField) {
          console.log('配列フィールドには少なくとも1つの選択肢が必要です。');
        }
        if (!options.length && isEnumField) {
          console.log('Enum フィールドには少なくとも1つの選択肢が必要です。');
        }
      } while (!options.length && (isArrayField || isEnumField));
    }
  }

  const field = {
    name: trimmedName,
    label: trimmedLabel,
    fieldType,
    formInput: normalizedInput,
    required: isArrayField ? false : requiredAnswer.required,
    ...(uploadPath ? { uploadPath } : {}),
    ...(slug ? { slug } : {}),
    ...(options && options.length ? { options } : {}),
  };

  console.log('\nフィールドを追加しました:', field, '\n');

  return field;
}

export default async function askFields(config) {
  const fields = [];
  config._fieldIndex = 0;
  while (true) {
    const field = await askSingleField(config);
    if (!field) break;
    fields.push(field);
    config._fieldIndex += 1;
  }
  delete config._fieldIndex;
  return { fields };
}
