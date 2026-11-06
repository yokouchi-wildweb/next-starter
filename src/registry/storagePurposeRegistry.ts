// 生成物・編集不可: pnpm generate registry が src/features/**/services/server/storagePurposes.ts から生成する
// src/registry/storagePurposeRegistry.ts
//
// ドメインのファイル用途の一覧。core と fork の項目は features/core/storageObject/purposes/、合成は storageObject/services/server/purposeSource.ts。型と規則: src/lib/storage/README.md

import "server-only";

import type { StoragePurposeMap } from "@/lib/storage";

import { purposes as samplePurposes } from "@/features/sample/services/server/storagePurposes";
import { purposes as sampleImagePurposes } from "@/features/sampleImage/services/server/storagePurposes";

export const storagePurposeRegistry: StoragePurposeMap[] = [
  samplePurposes,
  sampleImagePurposes,
];
