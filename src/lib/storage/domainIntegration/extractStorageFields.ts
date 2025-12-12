// src/lib/storage/domainIntegration/extractStorageFields.ts

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
 * domainConfigからmediaUploaderフィールド名を抽出する
 */
export function extractStorageFields(domainConfig: DomainConfigForStorage): string[] {
  if (!domainConfig.fields) return [];
  return domainConfig.fields
    .filter((f) => f.fieldType === "mediaUploader")
    .map((f) => f.name);
}

/**
 * domainConfigからmediaUploaderフィールドの詳細情報を抽出する
 */
export function extractStorageFieldsWithPath(domainConfig: DomainConfigForStorage): StorageFieldInfo[] {
  if (!domainConfig.fields) return [];
  return domainConfig.fields
    .filter((f) => f.fieldType === "mediaUploader")
    .map((f) => ({
      name: f.name,
      uploadPath: f.uploadPath ?? "",
    }));
}
