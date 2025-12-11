import inquirer from 'inquirer';
import { FORM_INPUTS } from '../form-inputs.mjs';
import { toCamelCase, toSnakeCase } from '../../../src/utils/stringCase.mjs';
const prompt = inquirer.createPromptModule();

const NUMERIC_FIELD_TYPES = new Set(['number', 'integer', 'float', 'bigint', 'numeric(10,2)']);
const DEFAULT_VALUE_EXCLUDED_TYPES = new Set(['timestamp', 'timestamp With Time Zone', 'array', 'jsonb']);
const MEDIA_ACCEPT_PRESETS = [
  { value: 'images', label: '画像のみ (image/*)', accept: 'image/*' },
  { value: 'videos', label: '動画のみ (video/*)', accept: 'video/*' },
  { value: 'imagesAndVideos', label: '画像・動画の両方 (image/*, video/*)', accept: 'image/*,video/*' },
  { value: 'all', label: '制限なし (全てのファイル)', accept: '' },
];
const DEFAULT_MEDIA_PRESET = 'images';
const DEFAULT_MAX_FILE_SIZE_MB = 100;
const READONLY_SUPPORTED_FORM_INPUTS = new Set(['textInput', 'numberInput', 'textarea']);
const MEDIA_METADATA_CHOICES = [
  { name: 'ファイルサイズ (sizeBytes)', value: 'sizeBytes' },
  { name: '幅 (width)', value: 'width' },
  { name: '高さ (height)', value: 'height' },
  { name: 'アスペクト比 (aspectRatio)', value: 'aspectRatio' },
  { name: '向き (orientation)', value: 'orientation' },
  { name: 'MIME タイプ (mimeType)', value: 'mimeType' },
  { name: '元 URL (src)', value: 'src' },
  { name: '動画の再生時間 (durationSec)', value: 'durationSec' },
  { name: '動画の再生時間（書式付き）(durationFormatted)', value: 'durationFormatted' },
];

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

async function askDefaultValue(fieldType, options) {
  // 対象外のフィールドタイプはスキップ
  if (DEFAULT_VALUE_EXCLUDED_TYPES.has(fieldType)) {
    return undefined;
  }

  const isNumericField = isNumericFieldType(fieldType);
  const isBooleanField = fieldType === 'boolean';
  const isEnumField = fieldType === 'enum';

  // enum: 選択式
  if (isEnumField && options && options.length > 0) {
    const choices = [
      { name: '(設定しない)', value: '__SKIP__' },
      ...options.map((opt) => ({ name: `${opt.label} (${opt.value})`, value: opt.value })),
    ];
    const { defaultValue } = await prompt({
      type: 'list',
      name: 'defaultValue',
      message: 'デフォルト値を選択（設定しない場合は最初の項目）:',
      choices,
    });
    return defaultValue === '__SKIP__' ? undefined : defaultValue;
  }

  // boolean: true/false のみ許可
  if (isBooleanField) {
    const { defaultValue } = await prompt({
      type: 'list',
      name: 'defaultValue',
      message: 'デフォルト値を選択:',
      choices: [
        { name: '(設定しない)', value: '__SKIP__' },
        { name: 'true', value: true },
        { name: 'false', value: false },
      ],
    });
    return defaultValue === '__SKIP__' ? undefined : defaultValue;
  }

  // 数値: Number() 変換
  if (isNumericField) {
    while (true) {
      const { defaultValue } = await prompt({
        type: 'input',
        name: 'defaultValue',
        message: 'デフォルト値（空でスキップ）:',
      });
      const trimmed = defaultValue.trim();
      if (!trimmed) return undefined;
      const numericValue = Number(trimmed);
      if (Number.isNaN(numericValue)) {
        console.log('数値を入力してください。');
        continue;
      }
      return numericValue;
    }
  }

  // 文字列: そのまま
  const { defaultValue } = await prompt({
    type: 'input',
    name: 'defaultValue',
    message: 'デフォルト値（空でスキップ）:',
  });
  const trimmed = defaultValue.trim();
  return trimmed || undefined;
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
  let mediaTypePreset;
  let acceptValue;
  let maxSizeBytes;
  let metadataBinding;
  if (normalizedInput === 'mediaUploader') {
    const domainSlug = toCamelCase(config.singular ?? '') || 'domain';
    const uploadExample = `${domainSlug}/main`;
    while (true) {
      const up = await prompt({
        type: 'input',
        name: 'uploadPath',
        message: `画像の保存パス（例: ${uploadExample}）:`,
      });
      uploadPath = typeof up.uploadPath === 'string' ? up.uploadPath.trim() : '';
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

    const presetChoices = MEDIA_ACCEPT_PRESETS.map((preset) => ({
      name: preset.label,
      value: preset.value,
    }));
    const presetAnswer = await prompt({
      type: 'list',
      name: 'mediaTypePreset',
      message: '許可するファイルタイプを選択:',
      choices: presetChoices,
      default: DEFAULT_MEDIA_PRESET,
    });
    mediaTypePreset = presetAnswer.mediaTypePreset || DEFAULT_MEDIA_PRESET;
    const preset = MEDIA_ACCEPT_PRESETS.find((item) => item.value === mediaTypePreset);
    acceptValue = preset?.accept ?? '';

    const maxAnswer = await prompt({
      type: 'input',
      name: 'maxFileSizeMb',
      message: '最大ファイルサイズ (MB 単位):',
      default: String(DEFAULT_MAX_FILE_SIZE_MB),
      validate: (input) => {
        const rawInput = typeof input === 'number' ? String(input) : input ?? '';
        const trimmed = rawInput.trim();
        if (!trimmed) return '数値を入力してください。';
        const value = Number(trimmed);
        if (Number.isNaN(value)) {
          return '数値で入力してください (例: 50)。';
        }
        if (value <= 0) {
          return '1以上の値を入力してください。';
        }
        return true;
      },
    });
    const parsedMax = Number(maxAnswer.maxFileSizeMb);
    if (!Number.isNaN(parsedMax) && parsedMax > 0) {
      maxSizeBytes = Math.round(parsedMax * 1024 * 1024);
    }

    const { enableMetadataBinding } = await prompt({
      type: 'confirm',
      name: 'enableMetadataBinding',
      message: 'メタデータをフォームの他フィールドへ保存しますか？',
      default: false,
    });
    if (enableMetadataBinding) {
      const { metadataKeys } = await prompt({
        type: 'checkbox',
        name: 'metadataKeys',
        message: '保存したいメタデータ項目を選択してください（スペースで選択、エンターで確定）:',
        choices: MEDIA_METADATA_CHOICES,
      });
      if (metadataKeys.length) {
        metadataBinding = {};
        for (const key of metadataKeys) {
          while (true) {
            const { fieldName } = await prompt({
              type: 'input',
              name: 'fieldName',
              message: `${key} を保存するフィールド名（snake_case）:`,
            });
            const trimmedFieldName = typeof fieldName === 'string' ? fieldName.trim() : '';
            if (!trimmedFieldName) {
              console.log('フィールド名を入力してください。');
              continue;
            }
            metadataBinding[key] = toSnakeCase(trimmedFieldName);
            break;
          }
        }
      }
    }
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

  // デフォルト値の質問（mediaUploader は対象外）
  let defaultValue;
  if (normalizedInput !== 'mediaUploader') {
    defaultValue = await askDefaultValue(fieldType, options);
  }

  const field = {
    name: trimmedName,
    label: trimmedLabel,
    fieldType,
    formInput: normalizedInput,
    ...(READONLY_SUPPORTED_FORM_INPUTS.has(normalizedInput) ? { readonly: false } : {}),
    required: isArrayField ? false : requiredAnswer.required,
    ...(uploadPath ? { uploadPath } : {}),
    ...(slug ? { slug } : {}),
    ...(mediaTypePreset ? { mediaTypePreset } : {}),
    ...(acceptValue ? { accept: acceptValue } : {}),
    ...(typeof maxSizeBytes === 'number'
      ? { validationRule: { maxSizeBytes } }
      : {}),
    ...(metadataBinding ? { metadataBinding } : {}),
    ...(options && options.length ? { options } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
  };

  const shouldAssignDisplayType =
    normalizedInput === 'radio' || (normalizedInput === 'checkbox' && isArrayField);
  if (shouldAssignDisplayType) {
    field.displayType = 'standard';
  }

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
