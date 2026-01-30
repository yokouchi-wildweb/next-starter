// scripts/role-config/questions/profile-fields.mjs
// プロフィールフィールドの収集

import inquirer from "inquirer";
import { toCamelCase, toSnakeCase } from "../../../src/utils/stringCase.mjs";
import { PROFILE_FORM_INPUTS, PROFILE_FIELD_TAGS } from "../form-inputs.mjs";
import chalk from "chalk";

const prompt = inquirer.createPromptModule();

const NUMERIC_FIELD_TYPES = new Set(["integer", "float", "bigint", "numeric(10,2)"]);
const DEFAULT_VALUE_EXCLUDED_TYPES = new Set(["timestamp With Time Zone", "array", "jsonb"]);
const READONLY_SUPPORTED_FORM_INPUTS = new Set(["textInput", "numberInput", "textarea"]);
const MEDIA_ACCEPT_PRESETS = [
  { value: "images", label: "画像のみ (image/*)", accept: "image/*" },
  { value: "videos", label: "動画のみ (video/*)", accept: "video/*" },
  { value: "imagesAndVideos", label: "画像・動画の両方 (image/*, video/*)", accept: "image/*,video/*" },
  { value: "all", label: "制限なし (全てのファイル)", accept: "" },
];
const DEFAULT_MEDIA_PRESET = "images";
const DEFAULT_MAX_FILE_SIZE_MB = 100;
const MEDIA_METADATA_CHOICES = [
  { name: "ファイルサイズ (sizeBytes)", value: "sizeBytes" },
  { name: "幅 (width)", value: "width" },
  { name: "高さ (height)", value: "height" },
  { name: "アスペクト比 (aspectRatio)", value: "aspectRatio" },
  { name: "向き (orientation)", value: "orientation" },
  { name: "MIME タイプ (mimeType)", value: "mimeType" },
  { name: "元 URL (src)", value: "src" },
  { name: "動画の再生時間 (durationSec)", value: "durationSec" },
  { name: "動画の再生時間（書式付き）(durationFormatted)", value: "durationFormatted" },
];

/**
 * 選択肢を収集
 */
async function askOptions(parseValue) {
  const options = [];
  while (true) {
    const { value } = await prompt({
      type: "input",
      name: "value",
      message:
        options.length === 0
          ? "選択肢として保存する値（例: apple。空で終了）:"
          : "次の選択肢として保存する値（空で終了）:",
    });
    if (!value.trim()) break;

    let parsedValue = value.trim();
    if (parseValue) {
      try {
        parsedValue = parseValue(value.trim());
      } catch (error) {
        console.log(error.message || "選択肢の値が不正です。");
        continue;
      }
    }

    const { label } = await prompt({
      type: "input",
      name: "label",
      message: `値 "${parsedValue}" の表示ラベル:`,
      default: parsedValue.toString(),
    });

    options.push({ value: parsedValue, label: label.trim() || parsedValue.toString() });
  }
  return options;
}

/**
 * デフォルト値を収集
 */
async function askDefaultValue(fieldType, options) {
  // 対象外のフィールドタイプはスキップ
  if (DEFAULT_VALUE_EXCLUDED_TYPES.has(fieldType)) {
    return undefined;
  }

  const isNumericField = NUMERIC_FIELD_TYPES.has(fieldType);
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

/**
 * 単一フィールドの収集
 */
async function askSingleField(fieldIndex) {
  // フィールド名
  const { name } = await prompt({
    type: "input",
    name: "name",
    message:
      fieldIndex === 0
        ? "フィールド名（snake_case。空でスキップ）:"
        : "フィールド名（snake_case。空で終了）:",
  });
  if (!name.trim()) return null;

  const trimmedName = toSnakeCase(name.trim());

  // 表示ラベル
  const { label } = await prompt({
    type: "input",
    name: "label",
    message: "フィールド表示名:",
    default: trimmedName,
  });
  const trimmedLabel = label.trim() || trimmedName;

  // フィールドタイプ
  const fieldTypes = Object.keys(PROFILE_FORM_INPUTS);
  const { fieldType } = await prompt({
    type: "list",
    name: "fieldType",
    message: "フィールドの型:",
    choices: fieldTypes,
  });

  // フォーム入力種別
  const formChoices = PROFILE_FORM_INPUTS[fieldType];
  const { formInput } = await prompt({
    type: "list",
    name: "formInput",
    message: "フォーム入力種別:",
    choices: formChoices,
  });
  const normalizedInput = toCamelCase(formInput);

  // フィールドタイプ別の判定
  const isBooleanField = fieldType === "boolean";
  const isArrayField = fieldType === "array";
  const isEnumField = fieldType === "enum";
  const isNumericField = NUMERIC_FIELD_TYPES.has(fieldType);

  // mediaUploader の場合の追加設定
  let uploadPath;
  let slug;
  let mediaTypePreset;
  let acceptValue;
  let maxSizeBytes;
  let metadataBinding;
  if (normalizedInput === "mediaUploader") {
    const uploadExample = `profiles/${trimmedName}`;
    while (true) {
      const up = await prompt({
        type: "input",
        name: "uploadPath",
        message: `画像の保存パス（例: ${uploadExample}）:`,
      });
      uploadPath = typeof up.uploadPath === "string" ? up.uploadPath.trim() : "";
      if (uploadPath) break;
      console.log("画像の保存パスは必須です。空で続行することはできません。");
    }
    const camelName = toCamelCase(trimmedName);
    const baseSlug = camelName
      .replace(/ImageUrl$/, "")
      .replace(/Url$/, "")
      .replace(/Image$/, "");
    const sl = await prompt({
      type: "input",
      name: "slug",
      message: "画像ハンドラ名用のスラッグ（camelCase、ハイフン不可）:",
      default: baseSlug,
    });
    slug = sl.slug.trim() || baseSlug;

    const presetChoices = MEDIA_ACCEPT_PRESETS.map((preset) => ({
      name: preset.label,
      value: preset.value,
    }));
    const presetAnswer = await prompt({
      type: "list",
      name: "mediaTypePreset",
      message: "許可するファイルタイプを選択:",
      choices: presetChoices,
      default: DEFAULT_MEDIA_PRESET,
    });
    mediaTypePreset = presetAnswer.mediaTypePreset || DEFAULT_MEDIA_PRESET;
    const preset = MEDIA_ACCEPT_PRESETS.find((item) => item.value === mediaTypePreset);
    acceptValue = preset?.accept ?? "";

    const maxAnswer = await prompt({
      type: "input",
      name: "maxFileSizeMb",
      message: "最大ファイルサイズ (MB 単位):",
      default: String(DEFAULT_MAX_FILE_SIZE_MB),
      validate: (input) => {
        const rawInput = typeof input === "number" ? String(input) : input ?? "";
        const trimmed = rawInput.trim();
        if (!trimmed) return "数値を入力してください。";
        const value = Number(trimmed);
        if (Number.isNaN(value)) {
          return "数値で入力してください (例: 50)。";
        }
        if (value <= 0) {
          return "1以上の値を入力してください。";
        }
        return true;
      },
    });
    const parsedMax = Number(maxAnswer.maxFileSizeMb);
    if (!Number.isNaN(parsedMax) && parsedMax > 0) {
      maxSizeBytes = Math.round(parsedMax * 1024 * 1024);
    }

    const { enableMetadataBinding } = await prompt({
      type: "confirm",
      name: "enableMetadataBinding",
      message: "メタデータをフォームの他フィールドへ保存しますか？",
      default: false,
    });
    if (enableMetadataBinding) {
      const { metadataKeys } = await prompt({
        type: "checkbox",
        name: "metadataKeys",
        message: "保存したいメタデータ項目を選択してください（スペースで選択、エンターで確定）:",
        choices: MEDIA_METADATA_CHOICES,
      });
      if (metadataKeys.length) {
        metadataBinding = {};
        for (const key of metadataKeys) {
          while (true) {
            const { fieldName } = await prompt({
              type: "input",
              name: "fieldName",
              message: `${key} を保存するフィールド名（snake_case）:`,
            });
            const trimmedFieldName = typeof fieldName === "string" ? fieldName.trim() : "";
            if (!trimmedFieldName) {
              console.log("フィールド名を入力してください。");
              continue;
            }
            metadataBinding[key] = toSnakeCase(trimmedFieldName);
            break;
          }
        }
      }
    }
  }

  // 必須設定
  let required = false;
  if (!isArrayField && normalizedInput !== "hidden") {
    const { requiredAnswer } = await prompt({
      type: "confirm",
      name: "requiredAnswer",
      message: "このフィールドを必須にしますか？",
      default: false,
    });
    required = requiredAnswer;
  }

  // プレースホルダー（テキスト系のみ）
  let placeholder;
  if (["textInput", "textarea", "numberInput"].includes(normalizedInput)) {
    const { placeholderAnswer } = await prompt({
      type: "input",
      name: "placeholderAnswer",
      message: "プレースホルダー（空でスキップ）:",
    });
    if (placeholderAnswer.trim()) {
      placeholder = placeholderAnswer.trim();
    }
  }

  // readonly（テキスト系のみ）
  let readonly = false;
  if (READONLY_SUPPORTED_FORM_INPUTS.has(normalizedInput)) {
    const { readonlyAnswer } = await prompt({
      type: "confirm",
      name: "readonlyAnswer",
      message: "このフィールドを読み取り専用にしますか？",
      default: false,
    });
    readonly = readonlyAnswer;
  }

  // 選択肢（select, radio, checkbox, multiSelect, enum）
  let options;
  const needsOptions =
    isBooleanField ||
    isArrayField ||
    isEnumField ||
    normalizedInput === "radio" ||
    normalizedInput === "select" ||
    (normalizedInput === "checkbox" && !isBooleanField);

  if (needsOptions) {
    if (isBooleanField) {
      console.log("真偽値フィールドのため、選択肢は自動的に設定されます。");
      options = [
        { value: true, label: "はい" },
        { value: false, label: "いいえ" },
      ];
    } else {
      const optionValueParser = isNumericField
        ? (v) => {
            const num = Number(v);
            if (Number.isNaN(num)) throw new Error("数値を入力してください。");
            return num;
          }
        : undefined;

      console.log("選択肢を入力してください。空欄で入力終了。");
      do {
        options = await askOptions(optionValueParser);
        if (!options.length && (isArrayField || isEnumField)) {
          console.log("少なくとも1つの選択肢が必要です。");
        }
      } while (!options.length && (isArrayField || isEnumField));
    }
  }

  // デフォルト値の質問（mediaUploader は対象外）
  let defaultValue;
  if (normalizedInput !== "mediaUploader") {
    defaultValue = await askDefaultValue(fieldType, options);
  }

  // フィールドオブジェクト構築（tagsは後で別途収集）
  // Boolean型の場合: required=false → nullable: true（NULLを許容）
  // Boolean型はデフォルトで notNull なので、明示的にNULLを許容する場合のみ nullable を設定
  const field = {
    name: trimmedName,
    label: trimmedLabel,
    fieldType,
    formInput: normalizedInput,
    ...(READONLY_SUPPORTED_FORM_INPUTS.has(normalizedInput) ? { readonly } : {}),
    ...(required ? { required: true } : {}),
    ...(isBooleanField && !required ? { nullable: true } : {}),
    ...(uploadPath ? { uploadPath } : {}),
    ...(slug ? { slug } : {}),
    ...(mediaTypePreset ? { mediaTypePreset } : {}),
    ...(acceptValue ? { accept: acceptValue } : {}),
    ...(typeof maxSizeBytes === "number" ? { validationRule: { maxSizeBytes } } : {}),
    ...(metadataBinding ? { metadataBinding } : {}),
    ...(placeholder ? { placeholder } : {}),
    ...(options && options.length ? { options } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
  };

  // displayType の設定（radio/checkbox）
  const shouldAssignDisplayType =
    normalizedInput === "radio" || (normalizedInput === "checkbox" && isArrayField);
  if (shouldAssignDisplayType) {
    field.displayType = "standard";
  }

  console.log("\nフィールドを追加しました:", field, "\n");
  return field;
}

/**
 * タグごとにフィールドを選択
 * @param {Array} fields - 収集済みフィールド
 * @returns {Promise<Object>} タグマッピング
 */
async function askTagMappings(fields) {
  console.log("\n=== タグマッピングの設定 ===\n");
  console.log("各タグに紐づけるフィールドを選択してください。\n");

  // hidden以外のフィールドを選択肢として提供
  const selectableFields = fields.filter((f) => f.formInput !== "hidden");
  const hiddenFields = fields.filter((f) => f.formInput === "hidden");

  if (selectableFields.length === 0) {
    console.log("選択可能なフィールドがありません（全てhidden）。");
    // hiddenフィールドはadminタグに自動割り当て
    const tags = {};
    if (hiddenFields.length > 0) {
      tags.admin = hiddenFields.map((f) => f.name);
    }
    return tags;
  }

  const fieldChoices = selectableFields.map((f) => ({
    name: `${f.label} (${f.name})`,
    value: f.name,
  }));

  const tags = {};

  for (const tagConfig of PROFILE_FIELD_TAGS) {
    const tagValue = tagConfig.value;
    const tagLabel = tagConfig.name || tagConfig.label;

    const { selectedFields } = await prompt({
      type: "checkbox",
      name: "selectedFields",
      message: `${chalk.cyan(tagLabel)} に表示するフィールド:`,
      choices: fieldChoices,
    });

    tags[tagValue] = selectedFields;
  }

  // hiddenフィールドは自動的にadminタグに追加
  if (hiddenFields.length > 0) {
    const hiddenNames = hiddenFields.map((f) => f.name);
    if (tags.admin) {
      // 重複を除いて追加
      tags.admin = [...new Set([...tags.admin, ...hiddenNames])];
    } else {
      tags.admin = hiddenNames;
    }
  }

  return tags;
}

/**
 * プロフィールフィールドを収集
 * @returns {Promise<{fields: Array, tags: Object}>}
 */
export default async function askProfileFields() {
  console.log("\n=== プロフィールフィールドの設定 ===\n");

  const fields = [];
  let fieldIndex = 0;

  while (true) {
    const field = await askSingleField(fieldIndex);
    if (!field) break;
    fields.push(field);
    fieldIndex += 1;
  }

  if (fields.length === 0) {
    return { fields, tags: {} };
  }

  // タグマッピングを収集
  const tags = await askTagMappings(fields);

  return { fields, tags };
}
