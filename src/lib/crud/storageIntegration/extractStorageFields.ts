// src/lib/crud/storageIntegration/extractStorageFields.ts

type DomainFieldConfig = {
  name: string;
  fieldType: string;
  uploadPath?: string;
};

type DomainConfigForStorage = {
  fields?: DomainFieldConfig[];
};

export type StorageFieldInfo = {
  name: string;
  uploadPath: string;
};

/**
 * Storage にファイルを保存するフィールドの fieldType 一覧。
 * - mediaUploader: 単一ファイル（DBは string）
 * - mediaUploaderMulti: 複数ファイル（DBは string[] / text[]）
 * cleanupStorageFiles / duplicateStorageFiles は string と string[] の両方を扱う。
 */
const STORAGE_FIELD_TYPES = ["mediaUploader", "mediaUploaderMulti"] as const;

function isStorageField(fieldType: string): boolean {
  return (STORAGE_FIELD_TYPES as readonly string[]).includes(fieldType);
}

/**
 * domainConfigからStorageファイルを保持するフィールド名を抽出する
 * （mediaUploader / mediaUploaderMulti の両方）
 */
export function extractStorageFields(domainConfig: DomainConfigForStorage): string[] {
  if (!domainConfig.fields) return [];
  return domainConfig.fields
    .filter((f) => isStorageField(f.fieldType))
    .map((f) => f.name);
}

/**
 * domainConfigからStorageファイルを保持するフィールドの詳細情報を抽出する
 * （mediaUploader / mediaUploaderMulti の両方）
 */
export function extractStorageFieldsWithPath(domainConfig: DomainConfigForStorage): StorageFieldInfo[] {
  if (!domainConfig.fields) return [];
  return domainConfig.fields
    .filter((f) => isStorageField(f.fieldType))
    .map((f) => ({
      name: f.name,
      uploadPath: f.uploadPath ?? "",
    }));
}
