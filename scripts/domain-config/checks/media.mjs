// 検査: メディア項目（accept・mediaTypePreset・metadataBinding）。
// accept が空だと生成（ファイル用途の登録）が止まり、lib は「何でも受ける」"*/*" を受けない。preset の綴り違いは
// 黙って "all" の上限になり、metadataBinding の綴り違いや書き先の無い項目は黙って捨てられるので、生成前に止める。
// 規則の正: src/features/README.md「メディア項目」・「ファイルの保存（storage）」

import { MEDIA_FIELD_TYPES } from "../spec/fieldTypes.mjs";

/** mediaTypePreset の値（render/registry/storagePurpose/entries.mjs と同じ） */
const PRESETS = new Set(["images", "videos", "imagesAndVideos", "all"]);
/** metadataBinding のキー（src/lib/mediaInputSuite/types.ts のメタデータ） */
const METADATA_KEYS = new Set(["sizeBytes", "width", "height", "aspectRatio", "orientation", "mimeType", "src", "durationSec", "durationFormatted"]);

/**
 * @param {object} config domain.json
 * @returns {string[]} 問題（空なら無し）
 */
export function mediaIssues(config) {
  const issues = [];
  const fieldNames = new Set((config.fields ?? []).map((field) => field?.name));
  for (const field of config.fields ?? []) {
    if (!MEDIA_FIELD_TYPES.has(field?.fieldType)) continue;
    const where = `fields "${field.name}"`;
    const contentTypes = String(field.accept ?? "").split(",").map((v) => v.trim()).filter(Boolean);
    if (contentTypes.length === 0) {
      issues.push(`${where}: accept に受け付ける型を書いてください（例: "image/*"。制限なしでも型を列挙する）`);
    }
    if (field.mediaTypePreset !== undefined && !PRESETS.has(field.mediaTypePreset)) {
      issues.push(`${where}: mediaTypePreset "${field.mediaTypePreset}" は ${[...PRESETS].join(" / ")} のどれでもありません`);
    }
    const binding = field.metadataBinding;
    if (binding === undefined) continue;
    if (!binding || typeof binding !== "object" || Array.isArray(binding)) {
      issues.push(`${where}: metadataBinding は { メタデータのキー: 書き先の項目名 } で書いてください`);
      continue;
    }
    for (const [key, target] of Object.entries(binding)) {
      if (!METADATA_KEYS.has(key)) issues.push(`${where}: metadataBinding のキー "${key}" は ${[...METADATA_KEYS].join(" / ")} のどれでもありません`);
      if (!fieldNames.has(target)) issues.push(`${where}: metadataBinding.${key} の書き先 "${target}" が fields にありません`);
    }
  }
  return issues;
}
