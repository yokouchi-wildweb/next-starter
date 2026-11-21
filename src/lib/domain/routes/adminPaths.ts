// src/lib/domain/routes/adminPaths.ts

import { toKebabCase } from "@/lib/stringCase/index.mjs";

/**
 * ドメインの管理画面のパス(一覧・新規作成・詳細・編集)を生成する
 */

export type AdminPaths = {
  /** 一覧ページ */
  list: string;
  /** 新規作成ページ */
  new: string;
  /** 詳細ページ */
  detail: (id: string) => string;
  /** 編集ページ */
  edit: (id: string) => string;
};

/**
 * 基本のパス生成(getAdminPaths の中身。外へは出さない)
 *
 * @param basePath - ベースとなるパス
 * @returns CRUDパスオブジェクト
 *
 * @example
 * const paths = getCrudPaths("/admin/users/general");
 * paths.list        // "/admin/users/general"
 * paths.new         // "/admin/users/general/new"
 * paths.detail("1") // "/admin/users/general/1"
 * paths.edit("1")   // "/admin/users/general/1/edit"
 */
function getCrudPaths(basePath: string): AdminPaths {
  return {
    list: basePath,
    new: `${basePath}/new`,
    detail: (id: string) => `${basePath}/${id}`,
    edit: (id: string) => `${basePath}/${id}/edit`,
  };
}

/**
 * 管理画面のパス生成
 *
 * @param slugPlural - ドメインのslugPlural（kebab-case複数形）
 * @returns CRUDパスオブジェクト
 *
 * @example
 * const paths = getAdminPaths("samples");
 * paths.list        // "/admin/samples"
 * paths.new         // "/admin/samples/new"
 * paths.detail("1") // "/admin/samples/1"
 * paths.edit("1")   // "/admin/samples/1/edit"
 */
export function getAdminPaths(slugPlural: string): AdminPaths {
  return getCrudPaths(`/admin/${toKebabCase(slugPlural)}`);
}
