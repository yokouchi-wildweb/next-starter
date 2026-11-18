# adminManageTabs(管理のユーザー管理モーダルのタブの受け口)

## Overview

管理のユーザー一覧から開くユーザー管理のモーダル（`components/admin/AdminUserManageModal`）は、上流の 6 つのタブ（概要・認証情報・ステータス変更・ロール変更・削除・操作履歴）の後ろに受け口 `adminManageTabs` の項目を並べる。モーダルは上流の画面から開かれ、fork は開く所を変えられない。

項目は `adminManageTabs/<名前>.tsx`（`export const tab: UserAdminManageTabItem`、上流の項目は 0）。絞り込みと並びは `hooks/useAdminManageTabs.ts`（`selectAdminManageTabs` は純関数）。

- 項目の型 `UserAdminManageTabItem`（`@/features/core/user/types`）: `key`（タブの value）・`label`・`order?`（小さいほど前、省略 0、同じなら key の順）・`feature?`（門番の規則の名前。閉なら出さない）・`Content`（`{ user, onClose }` を受ける部品）
- 上流のタブは置き換えない・消さない・並べ替えない。`key` が上流のタブの value（`summary` / `auth` / `status` / `role` / `delete` / `history`）と重なる項目は出さず、`console.warn` で知らせる
- 置いたら `pnpm generate extensions`（一覧と `src/lib/forkOwnership/intake.txt` の受け口の行は生成）。key の重なる項目が 2 つあると一覧の読み込みで止まる
- 回帰: `pnpm test src/features/core/user/components/admin/AdminUserManageModal`

## Related

- 受け口の仕組み: `scripts/structure/extensions/README.md`
