"use client";

import { useContext } from "react";

import { AuthSessionContext } from "@/features/auth/components/AuthSessionContext";

export function useAuthSession() {
  // 認証 Context からユーザー情報と補助フラグ／操作を取得するための薄いラッパーフック。
  return useContext(AuthSessionContext);
}
