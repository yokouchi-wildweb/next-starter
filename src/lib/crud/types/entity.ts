// src/lib/crud/types/entity.ts
// エンティティの基本型と一覧ページの検索パラメータ

// ============================================================
// エンティティ基本型
// ============================================================

export interface BaseEntity {
  id: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// ============================================================
// ページ検索パラメータ
// ============================================================

export type ListPageSearchParams = {
  page?: string;
  searchQuery?: string;
  sortBy?: string;
};
