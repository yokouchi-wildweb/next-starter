// src/features/auth/hooks/useEmailLinkSignIn.ts

"use client";

// メールリンクでサインインするためのカスタムフック
import { useCallback, useState } from "react";

import { signInWithEmailLinkClient } from "@/lib/firebase/client/signInWithEmailLinkClient";
import type { HttpError } from "@/lib/errors";

/**
 * メールリンクサインイン用のフック
 */
export function useEmailLinkSignIn() {
  const [loading, setLoading] = useState(false); // リクエストの進捗を管理
  const [error, setError] = useState<HttpError | null>(null); // 発生したエラーを保持

  const signIn = useCallback(
    async (email: string, link?: string) => {
      setLoading(true); // 呼び出し直後にローディングを開始
      setError(null); // 前回のエラーをリセット

      try {
        await signInWithEmailLinkClient(email, link); // Firebase サービスに委譲
      } catch (err) {
        setError(err as HttpError); // HttpError をそのまま保持
        throw err; // 呼び出し元にもエラーを伝搬
      } finally {
        setLoading(false); // 成否にかかわらずローディングを終了
      }
    },
    [],
  );

  return { signIn, loading, error } as const; // シンプルに必要な値のみ返す
}
