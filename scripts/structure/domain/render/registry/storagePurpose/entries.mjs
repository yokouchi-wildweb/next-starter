// domain.json のメディア項目 → ファイル用途のエントリ（`<domain>.<field>`: { visibility, maxBytes, contentTypes, metadata, image, upload, read }）。
// 導出の規則: src/features/README.md「ファイルの保存（storage）」。ファイルには触れない

import { MEDIA_FIELD_TYPES } from "../../../spec/fieldTypes.mjs";
import { allowsGeneralUser, isValidRule, resolveOperationRule, serializeRule, serializeStringArray, unionUploadRules } from "./rules.mjs";

const PURPOSE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9_]*$/;
const VISIBILITIES = new Set(["public", "private"]);
const PRESETS = new Set(["images", "videos", "imagesAndVideos", "all"]);
const METADATA_VALUES = new Set(["strip", "keep"]);
// strip の用途で受け付ける画像の型（src/lib/storage/metadata.ts の STRIP_IMAGE_TYPES と同じ。"image/*" はこの集合に読み替えられる）
const STRIP_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

const isImagePattern = (contentType) => contentType.toLowerCase().startsWith("image/");

// strip で描き直せない画像の型（image/heic・image/svg+xml など）。"image/*" と STRIP_IMAGE_TYPES は描き直せる
function isUnprocessableImagePattern(contentType) {
  const normalized = contentType.toLowerCase();
  return isImagePattern(normalized) && normalized !== "image/*" && !STRIP_IMAGE_TYPES.has(normalized);
}

/** 上限サイズ。validationRule.maxSizeBytes が無ければ preset の既定値（警告付き） */
function resolveMaxBytes(id, field, warnings) {
  const declaredMax = field.validationRule?.maxSizeBytes;
  if (Number.isInteger(declaredMax) && declaredMax > 0) return String(declaredMax);
  const preset = PRESETS.has(field.mediaTypePreset) ? field.mediaTypePreset : "all";
  const maxBytes = `STORAGE_CONFIG.defaultMaxBytesByPreset.${preset}`;
  warnings.push(`${id}: validationRule.maxSizeBytes が無いため、既定の上限 ${maxBytes}（src/config/app/storage.config.ts）を使います`);
  return maxBytes;
}

/** storage.{visibility,upload,read,metadata} の規則。問題があればエラー文、無ければ null */
function validateStorageRules(id, storage, contentTypes) {
  if (storage.visibility !== undefined && !VISIBILITIES.has(storage.visibility)) {
    return `${id}: storage.visibility は "public" か "private" にしてください`;
  }
  if (storage.upload !== undefined && (!isValidRule(storage.upload) || storage.upload === "public")) {
    return `${id}: storage.upload は "authenticated" / "none" / { roles, roleCategories } のいずれかにしてください`;
  }
  if (storage.read !== undefined && !isValidRule(storage.read)) {
    return `${id}: storage.read は "public" / "authenticated" / "none" / { roles, roleCategories } のいずれかにしてください`;
  }
  if (storage.metadata !== undefined && !METADATA_VALUES.has(storage.metadata)) {
    return `${id}: storage.metadata は "strip" か "keep" にしてください`;
  }
  const hasImage = contentTypes.some(isImagePattern);
  if (!hasImage && storage.metadata === "strip") {
    return `${id}: 画像の型が accept に無い項目に storage.metadata: "strip" は書けません（strip は画像にだけ効きます）`;
  }
  const unprocessable = hasImage && (storage.metadata ?? "strip") === "strip" ? contentTypes.filter(isUnprocessableImagePattern) : [];
  if (unprocessable.length > 0) {
    return (
      `${id}: storage.metadata が strip（省略時を含む）の項目の accept に、サーバーで描き直せない画像の型 ${unprocessable.join(", ")} があります` +
      `（受け付けられるのは ${[...STRIP_IMAGE_TYPES].join(" / ")}。原本のまま受けるなら storage.metadata: "keep"）`
    );
  }
  return null;
}

/**
 * storage.image（画像の縮小の指定）の規則。src/lib/storage/server/purposes.ts の listImageSpecProblems と同じ規則
 * （形・範囲・画像の型の無い項目・keep の項目には書けない）。問題があればエラー文、無ければ null
 */
function validateImageSpec(id, storage, contentTypes) {
  const image = storage.image;
  if (image === undefined) return null;
  if (typeof image !== "object" || image === null || Array.isArray(image)) {
    return `${id}: storage.image は { "maxDimension": <長い辺の上限 px>, "quality": <1〜100、省略可> } にしてください`;
  }
  const { maxDimension, quality } = image;
  if (!Number.isInteger(maxDimension) || maxDimension < 1) {
    return `${id}: storage.image.maxDimension は 1 以上の整数（長い辺の上限 px）にしてください`;
  }
  if (quality !== undefined && (!Number.isInteger(quality) || quality < 1 || quality > 100)) {
    return `${id}: storage.image.quality は 1〜100 の整数にしてください（省略 = storage.config の imageStrip.quality）`;
  }
  const unknownKeys = Object.keys(image).filter((key) => key !== "maxDimension" && key !== "quality");
  if (unknownKeys.length > 0) {
    return `${id}: storage.image に知らないキー ${unknownKeys.join(", ")} があります（書けるのは maxDimension・quality）`;
  }
  if (!contentTypes.some(isImagePattern)) {
    return `${id}: 画像の型が accept に無い項目に storage.image は書けません（縮小は画像にだけ効きます）`;
  }
  if (storage.metadata === "keep") {
    return `${id}: storage.metadata: "keep" の項目に storage.image は書けません（keep はサーバーが描き直さないので縮小を守らせられない。縮めるなら metadata を strip に）`;
  }
  return null;
}

/**
 * @returns {{ entries: { id: string, value: string }[], warnings: string[], errors: string[] }}
 */
export function buildStoragePurposeEntries({ camel, config, roleCategories = new Map() }) {
  const entries = [];
  const warnings = [];
  const errors = [];
  const apiAccess = config.apiAccess ?? null;

  for (const field of config.fields ?? []) {
    if (!MEDIA_FIELD_TYPES.has(field.fieldType)) continue;
    const id = `${camel}.${field.name}`;
    if (!PURPOSE_ID_PATTERN.test(id)) {
      errors.push(`${id}: 用途 ID が <domain>.<field> の形式（${PURPOSE_ID_PATTERN}）に合いません`);
      continue;
    }
    const contentTypes = String(field.accept ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (contentTypes.length === 0) {
      errors.push(`${id}: accept が空です（受け付ける型を書いてください）`);
      continue;
    }
    const maxBytes = resolveMaxBytes(id, field, warnings);

    const storage = field.storage ?? {};
    const ruleError = validateStorageRules(id, storage, contentTypes) ?? validateImageSpec(id, storage, contentTypes);
    if (ruleError) {
      errors.push(ruleError);
      continue;
    }
    // 画像を含む項目の省略 = strip（登録表には明示値で書き出す）。画像の無い項目には書き出さない
    const metadata = contentTypes.some(isImagePattern) ? (storage.metadata ?? "strip") : undefined;
    const uploadAllow =
      storage.upload ?? unionUploadRules([resolveOperationRule(apiAccess, "create"), resolveOperationRule(apiAccess, "update")]);
    // 読める人 = storage.read。無ければ apiAccess の get の規則（visibility の導出と private の read.allow の両方に使う）
    const readRule = storage.read ?? resolveOperationRule(apiAccess, "get");

    let visibility = storage.visibility;
    if (!visibility) {
      if (allowsGeneralUser(uploadAllow, roleCategories)) {
        errors.push(`${id}: 一般利用者がアップロードできる項目です。domain.json の storage.visibility（"public" / "private"）を明示してください`);
        continue;
      }
      visibility = readRule === "public" ? "public" : "private";
    }

    const parts = [
      `visibility: ${JSON.stringify(visibility)}`,
      `maxBytes: ${maxBytes}`,
      `contentTypes: ${serializeStringArray(contentTypes)}`,
      ...(metadata ? [`metadata: ${JSON.stringify(metadata)}`] : []),
      ...(storage.image ? [`image: ${serializeImageSpec(storage.image)}`] : []),
      `upload: { allow: ${serializeRule(uploadAllow)} }`,
    ];
    if (visibility === "private") parts.push(`read: { allow: ${serializeRule(readRule)} }`);
    entries.push({ id, value: `{ ${parts.join(", ")} }` });
  }

  return { entries, warnings, errors };
}

/** 縮小の指定を用途の値の文字列に（maxDimension、quality は書いたときだけ） */
function serializeImageSpec(image) {
  const keys = [`maxDimension: ${image.maxDimension}`, ...(image.quality !== undefined ? [`quality: ${image.quality}`] : [])];
  return `{ ${keys.join(", ")} }`;
}
