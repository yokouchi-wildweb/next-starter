import inquirer from 'inquirer';
import { FORM_INPUTS } from '../form-inputs.mjs';
import { toCamelCase, toSnakeCase } from '../../../src/utils/stringCase.mjs';
const prompt = inquirer.createPromptModule();

function parseOptionValue(input) {
  const trimmed = input.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function askOptions() {
  const options = [];
  while (true) {
    const { value } = await prompt({
      type: 'input',
      name: 'value',
      message:
        options.length === 0
          ? '選択肢の値（空で終了）:'
          : '次の選択肢の値（空で終了）:',
    });
    if (!value.trim()) break;
    const { label } = await prompt({
      type: 'input',
      name: 'label',
      message: `値 ${value} の表示名:`,
    });
    const trimmedLabel = label.trim() || value.trim();
    options.push({ value: parseOptionValue(value), label: trimmedLabel });
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

  let uploadPath;
  let slug;
  if (normalizedInput === 'imageUploader') {
    const up = await prompt({
      type: 'input',
      name: 'uploadPath',
      message: '画像の保存パス（例: cards/main）:',
    });
    uploadPath = up.uploadPath.trim();
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
      const guidance =
        isArrayField && normalizedInput === 'checkbox'
          ? 'チェックボックスで選択可能な値を入力してください。空欄で入力終了。値は文字列として保存されます。'
          : '選択肢を入力してください。空欄で入力終了。値は文字列として扱われます。';
      console.log(guidance);
      do {
        options = await askOptions();
        if (!options.length && isArrayField && normalizedInput === 'checkbox') {
          console.log('少なくとも1つの選択肢を登録してください。');
        }
      } while (!options.length && isArrayField && normalizedInput === 'checkbox');
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
