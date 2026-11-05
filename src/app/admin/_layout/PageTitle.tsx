// src/app/admin/_layout/PageTitle.tsx

import { AdminHeaderPortal } from "@/components/AppFrames/Admin/Elements/AdminHeaderPortal";

import { AdminPageTitleCompact, AdminPageTitleHeading, type AdminPageTitleHeadingProps } from "./AdminPageTitle";

export type AdminPageTitleProps = AdminPageTitleHeadingProps & {
  /**
   * タイトルの表示位置を指定します。
   * - "header": 管理画面ヘッダーのロゴ右隣に圧縮表示（デフォルト）。
   *   モバイル（sm 未満）では自動的にページ内表示にフォールバックします。
   *   ヘッダーにタイトルの受け口（./HeaderSlots の AdminHeaderSlots）が無いと sm 以上では表示されません。
   * - "page": ページ本文上部に大見出しとして表示
   */
  placement?: "page" | "header";
};

/**
 * @deprecated 管理のページの題は `<AdminPage title="…">` に渡す(./AdminPage。SP は本文の大見出し、PC はヘッダーの圧縮の題)。
 * 上流の使用は 0。fork が移し終えるまでの互換で、AdminHeaderPortal と受け口の id を消す指令 17 で一緒に消す(見た目と動きは前のまま)
 */
export default function PageTitle({ className, placement = "header", children, ...props }: AdminPageTitleProps) {
  // placement="header" の時、ページ内描画はモバイル限定（sm 以上は非表示）
  const pageBody = (
    <AdminPageTitleHeading className={placement === "header" ? `sm:hidden${className ? ` ${className}` : ""}` : className} {...props}>
      {children}
    </AdminPageTitleHeading>
  );

  if (placement === "page") {
    return pageBody;
  }

  return (
    <>
      {pageBody}
      <AdminHeaderPortal slot="title">
        <AdminPageTitleCompact as="h1">{children}</AdminPageTitleCompact>
      </AdminHeaderPortal>
    </>
  );
}
