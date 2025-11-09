import inquirer from 'inquirer';
import { toCamelCase, toSnakeCase } from '../../../src/utils/stringCase.mjs';
const prompt = inquirer.createPromptModule();

const FORM_INPUTS = {
  Firestore: {
    boolean: ['checkbox', 'select', 'radio', 'switch input', 'none'],
    string: [
      'text input',
      'textarea',
      'date input',
      'select',
      'image uploader',
      'number input',
      'password input',
      'none',
    ],
    number: ['number input', 'numeric input', 'none'],
    array: ['none'],
    timestamp: ['none'],
    geopoint: ['none'],
    reference: ['none'],
    map: ['none'],
    null: ['none'],
  },
  Neon: {
    string: [
      'text input',
      'textarea',
      'date input',
      'image uploader',
      'number input',
      'password input',
      'none',
    ],
    integer: ['number input', 'numeric input', 'none'],
    boolean: ['checkbox', 'select', 'radio', 'switch input', 'none'],
    enum: ['select', 'radio', 'none'],
    date: ['date input', 'text input', 'none'],
    bigint: ['number input', 'numeric input', 'none'],
    'numeric(10,2)': ['number input', 'numeric input', 'none'],
    uuid: ['text input', 'none'],
    Point: ['none'],
    'timestamp With Time Zone': ['none'],
    jsonb: ['none'],
    array: ['none'],
  },
};

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

  const { required } = await prompt({
    type: 'confirm',
    name: 'required',
    message: 'このフィールドを必須にしますか?',
    default: false,
  });

  let options;
  if (['checkbox', 'radio', 'select'].includes(normalizedInput)) {
    console.log('選択肢を入力してください。空欄で入力終了。値は文字列として扱われます。');
    options = await askOptions();
  }

  const field = {
    name: trimmedName,
    label: trimmedLabel,
    fieldType,
    formInput: normalizedInput,
    required,
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
