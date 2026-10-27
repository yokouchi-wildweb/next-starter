// フィールドの質問のうち「メディア列（mediaUploader / mediaUploaderMulti）」の追加質問。
// スラッグ・受け付ける型・上限サイズ・（複数なら）件数と並び替え・メタデータの保存先を聞き、storage の書き方を案内する

import inquirer from "inquirer";
import { toCamelCase, toSnakeCase } from "../../../../src/utils/stringCase.mjs";

const prompt = inquirer.createPromptModule();

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

function validatePositiveNumber(input) {
  const rawInput = typeof input === "number" ? String(input) : (input ?? "");
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
}

function validateOptionalInteger(min, message) {
  return (input) => {
    const trimmed = String(input ?? "").trim();
    if (!trimmed) return true;
    const num = Number(trimmed);
    if (!Number.isInteger(num) || num < min) {
      return message;
    }
    return true;
  };
}

async function askMultiItemRules() {
  const maxItemsAnswer = await prompt({
    type: "input",
    name: "maxItems",
    message: "最大アップロード件数（既定: 10）:",
    default: "10",
    validate: validateOptionalInteger(1, "1以上の整数で入力してください。"),
  });
  const parsedMax = Number(String(maxItemsAnswer.maxItems ?? "").trim());
  const maxItems = Number.isInteger(parsedMax) && parsedMax > 0 ? parsedMax : undefined;

  const minItemsAnswer = await prompt({
    type: "input",
    name: "minItems",
    message: "最小アップロード件数（任意、空欄で省略）:",
    default: "",
    validate: validateOptionalInteger(0, "0以上の整数で入力してください。"),
  });
  const parsedMin = Number(String(minItemsAnswer.minItems ?? "").trim());
  const minItems = Number.isInteger(parsedMin) && parsedMin >= 0 ? parsedMin : undefined;

  const reorderAnswer = await prompt({
    type: "confirm",
    name: "reorderable",
    message: "ドラッグで並び替えできるようにしますか？",
    default: true,
  });
  return { maxItems, minItems, reorderable: Boolean(reorderAnswer.reorderable) };
}

async function askMetadataBinding() {
  const { enableMetadataBinding } = await prompt({
    type: "confirm",
    name: "enableMetadataBinding",
    message: "メタデータをフォームの他フィールドへ保存しますか？",
    default: false,
  });
  if (!enableMetadataBinding) return undefined;
  const { metadataKeys } = await prompt({
    type: "checkbox",
    name: "metadataKeys",
    message: "保存したいメタデータ項目を選択してください（スペースで選択、エンターで確定）:",
    choices: MEDIA_METADATA_CHOICES,
  });
  if (!metadataKeys.length) return undefined;
  const metadataBinding = {};
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
  return metadataBinding;
}

/**
 * @param {string} trimmedName フィールド名（snake_case）
 * @param {"mediaUploader" | "mediaUploaderMulti"} normalizedInput
 */
export async function askMediaDetails(trimmedName, normalizedInput) {
  const camelName = toCamelCase(trimmedName);
  const baseSlug = camelName.replace(/ImageUrl$/, "").replace(/Url$/, "").replace(/Image$/, "");
  const sl = await prompt({
    type: "input",
    name: "slug",
    message: "画像ハンドラ名用のスラッグ（camelCase、ハイフン不可）:",
    default: baseSlug,
  });
  const slug = sl.slug.trim() || baseSlug;

  const presetAnswer = await prompt({
    type: "list",
    name: "mediaTypePreset",
    message: "許可するファイルタイプを選択:",
    choices: MEDIA_ACCEPT_PRESETS.map((preset) => ({ name: preset.label, value: preset.value })),
    default: DEFAULT_MEDIA_PRESET,
  });
  const mediaTypePreset = presetAnswer.mediaTypePreset || DEFAULT_MEDIA_PRESET;
  const acceptValue = MEDIA_ACCEPT_PRESETS.find((item) => item.value === mediaTypePreset)?.accept ?? "";

  const maxAnswer = await prompt({
    type: "input",
    name: "maxFileSizeMb",
    message: "最大ファイルサイズ (MB 単位):",
    default: String(DEFAULT_MAX_FILE_SIZE_MB),
    validate: validatePositiveNumber,
  });
  const parsedMax = Number(maxAnswer.maxFileSizeMb);
  const maxSizeBytes = !Number.isNaN(parsedMax) && parsedMax > 0 ? Math.round(parsedMax * 1024 * 1024) : undefined;
  console.log(
    '  ※ 一般利用者がアップロードできる項目は、domain.json のこの項目に "storage": { "visibility": "public" | "private" } を書いてください' +
      "（無いと dc:generate が止まります。詳細: src/features/README.md「ファイルの保存（storage）」）",
  );
  console.log(
    "  ※ 画像は既定でサーバーが位置情報などのメタデータを消して保存します（jpeg / png / webp / gif / avif のみ受付）。" +
      '原本のまま残す項目（書類・明細など）は "storage": { "metadata": "keep" } を書いてください',
  );

  const multi = normalizedInput === "mediaUploaderMulti" ? await askMultiItemRules() : {};
  const metadataBinding = await askMetadataBinding();
  return { slug, mediaTypePreset, acceptValue, maxSizeBytes, ...multi, metadataBinding };
}
