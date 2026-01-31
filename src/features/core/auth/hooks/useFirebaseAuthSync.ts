// src/features/auth/hooks/useFirebaseAuthSync.ts

"use client";

import { useEffect, useRef } from "react";
import { onAuthStateChanged, signInWithCustomToken } from "firebase/auth";

import { auth } from "@/lib/firebase/client/app";
import type { SessionUser } from "@/features/core/auth/entities/session";

/**
 * Firebase Auth の状態を監視し、ローカルセッションとの不整合を自動修復するフック。
 *
 * ローカル認証は成功しているが、Firebase Auth にサインインしていない場合（例: ログイン直後に
 * ブラウザがクラッシュした場合）に、カスタムトークンを再取得して自動的にサインインする。
 */
export function useFirebaseAuthSync(user: SessionUser | null) {
  // 同期処理中のフラグ（重複実行を防止）
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // ローカルセッションあり & Firebase Auth なし → 再サインインが必要
      if (user && !firebaseUser && !isSyncingRef.current) {
        isSyncingRef.current = true;

        try {
          const res = await fetch("/api/auth/firebase-token", { method: "POST" });

          if (res.ok) {
            const { firebaseCustomToken } = await res.json();
            await signInWithCustomToken(auth, firebaseCustomToken);
          }
        } catch {
          // サイレントに失敗。Storage 使用時にエラーが表示される。
        } finally {
          isSyncingRef.current = false;
        }
      }
    });

    return unsubscribe;
  }, [user]);
}
