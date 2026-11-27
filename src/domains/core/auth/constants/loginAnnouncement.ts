// src/domains/core/auth/constants/loginAnnouncement.ts
// ログインの後に出す知らせ(ページの読み直しの後に出る: 移る前のトーストは読み直しで消える、D139)。
// 呼び手がセッションを作る要求で名前を送り、route が src/lib/toast の redirect の cookie を積む(RedirectToastProvider が出す)。

export const LOGIN_ANNOUNCEMENTS = {
  /** 外部ログインで、登録済みの利用者としてログインした */
  alreadyRegistered: "登録済みユーザーでログインしました",
} as const;

export type LoginAnnouncement = keyof typeof LOGIN_ANNOUNCEMENTS;

/** 要求の値が知らせの名前ならその文、それ以外は null */
export function loginAnnouncementMessage(value: unknown): string | null {
  return typeof value === "string" && Object.hasOwn(LOGIN_ANNOUNCEMENTS, value) ? LOGIN_ANNOUNCEMENTS[value as LoginAnnouncement] : null;
}
