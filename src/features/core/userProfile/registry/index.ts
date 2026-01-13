// src/features/core/userProfile/registry/index.ts
// src/registry/ への再エクスポート（後方互換性のため）

export * from "@/registry/profileTableRegistry";
export {
  PROFILE_BASE_REGISTRY,
  PROFILE_ROLES,
  hasProfileBase,
  getProfileBase,
} from "@/registry/profileBaseRegistry";
