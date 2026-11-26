// 生成物・編集不可: pnpm generate registry が src/domains/**/services/server/*StoragePurposes.ts から生成する
// src/registry/storagePurposeRegistry.ts
//
// ドメインのファイル用途の一覧。core と fork の項目は <ドメイン>/plugs/storageObjectPurposes/、合成は storageObject/services/server/purposeSource.ts。型と規則: src/lib/storage/README.md

import "server-only";

import type { StoragePurposeMap } from "@/lib/storage";

import { purposes as samplePurposes } from "@/domains/sample/services/server/sampleStoragePurposes";
import { purposes as sampleImagePurposes } from "@/domains/sampleImage/services/server/sampleImageStoragePurposes";

export const storagePurposeRegistry: StoragePurposeMap[] = [
  samplePurposes,
  sampleImagePurposes,
];
