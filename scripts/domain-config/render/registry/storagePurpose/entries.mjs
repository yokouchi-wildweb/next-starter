// domain.json のメディア項目 → ファイル用途のエントリ（`<domain>.<field>`: { visibility, maxBytes, contentTypes, metadata, upload, read }）。
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

/** storage.{visibility,upload,metadata} の規則。問題があればエラー文、無ければ null */
function validateStorageRules(id, storage, contentTypes) {
  if (storage.visibility !== undefined && !VISIBILITIES.has(storage.visibility)) {
    return `${id}: storage.visibility は "public" か "private" にしてください`;
  }
  if (storage.upload !== undefined && (!isValidRule(storage.upload) || storage.upload === "public")) {
    return `${id}: storage.upload は "authenticated" / "none" / { roles, roleCategories } のいずれかにしてください`;
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
    const ruleError = validateStorageRules(id, storage, contentTypes);
    if (ruleError) {
      errors.push(ruleError);
      continue;
    }
    // 画像を含む項目の省略 = strip（登録表には明示値で書き出す）。画像の無い項目には書き出さない
    const metadata = contentTypes.some(isImagePattern) ? (storage.metadata ?? "strip") : undefined;
    const uploadAllow =
      storage.upload ?? unionUploadRules([resolveOperationRule(apiAccess, "create"), resolveOperationRule(apiAccess, "update")]);
    const getRule = resolveOperationRule(apiAccess, "get");

    let visibility = storage.visibility;
    if (!visibility) {
      if (allowsGeneralUser(uploadAllow, roleCategories)) {
        errors.push(`${id}: 一般利用者がアップロードできる項目です。domain.json の storage.visibility（"public" / "private"）を明示してください`);
        continue;
      }
      visibility = getRule === "public" ? "public" : "private";
    }

    const parts = [
      `visibility: ${JSON.stringify(visibility)}`,
      `maxBytes: ${maxBytes}`,
      `contentTypes: ${serializeStringArray(contentTypes)}`,
      ...(metadata ? [`metadata: ${JSON.stringify(metadata)}`] : []),
      `upload: { allow: ${serializeRule(uploadAllow)} }`,
    ];
    if (visibility === "private") parts.push(`read: { allow: ${serializeRule(getRule)} }`);
    entries.push({ id, value: `{ ${parts.join(", ")} }` });
  }

  return { entries, warnings, errors };
}
