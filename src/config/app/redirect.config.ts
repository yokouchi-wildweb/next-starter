import type { RedirectToastPayload } from "@/lib/redirectToast/types";
import type { UserRoleType } from "@/features/core/user/types";

export type RedirectRule = {
  sourcePaths: string[];
  destination: string;
  toast?: RedirectToastPayload;
  authedOnly?: boolean;
  guestOnly?: boolean;
  allowRoles?: UserRoleType[];
  excludeRoles?: UserRoleType[];
};

/**
 * リダイレクト条件の優先順
 * 1. `authedOnly`: true の場合はログイン済みユーザーのみ対象（デフォルト true）
 * 2. `guestOnly`: true の場合は未ログイン限定（ログイン済みなら即リダイレクト）
 * 3. `allowRoles`: 指定ロールのみに絞り込み（ホワイトリスト）
 * 4. `excludeRoles`: 指定ロールを除外（ブラックリスト）
 *
 * 上記は必要なものだけを指定する。
 * !! `authedOnly` と `guestOnly` を同時に true にしないこと。
 * `toast` を省略するとトーストなしの純粋なリダイレクトになる。
 */
export const redirectRules: RedirectRule[] = [
  // サンプル: すべての条件を指定したルール
  // {
  //   sourcePaths: ["/sample/path"],
  //   destination: "/",
  //   toast: {
  //     message: "条件付きリダイレクトのサンプル",
  //     variant: "success",
  //   },
  //   authedOnly: true,
  //   guestOnly: false,
  //   allowRoles: ["admin", "editor"],
  //   excludeRoles: ["guest"],
  // },

  {
    sourcePaths: ["/login", "/signup"],
    destination: "/",
    toast: {
      message: "すでにログイン済みです。",
      variant: "info",
    },
    guestOnly: true,
  },

];
