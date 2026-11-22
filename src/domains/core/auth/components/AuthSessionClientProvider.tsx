"use client";

import type { ReactNode } from "react";
import { Suspense, useCallback, useMemo, useState } from "react";

import type { SessionUser } from "@/domains/core/auth/entities/session";
import { useAuthSession } from "@/domains/core/auth/hooks/useAuthSession";
import { useFirebaseAuthSync } from "@/domains/core/auth/hooks/useFirebaseAuthSync";
import { useDauTracker } from "@/domains/core/analytics/hooks/useDauTracker";
import { useGate } from "@/featureGate/client";
// このコンポーネントはセッション状態の持ち主(Context の提供元)で、refreshSession はその状態更新そのもの
// (フック層に相当する)。利用側は useAuthSession / useSessionRefresh 経由で呼ぶので、例外として直接呼ぶ
// eslint-disable-next-line client-service-boundary/no-direct-import, core-ui-guards/no-guard-in-part -- セッションの持ち主(上の理由)。core-ui-guards も同じ理由
import { fetchSession } from "@/domains/core/auth/services/client/session";

import type { AuthSessionSource } from "./AuthSessionContext";
import { AuthSessionContext } from "./AuthSessionContext";

type AuthSessionClientProviderProps = {
  /** サーバーが渡したセッションの利用者の promise(解けた値が null = 未ログイン)。この Provider 自身は待たない */
  userPromise: Promise<SessionUser | null>;
  children: ReactNode;
};

export function AuthSessionClientProvider({ userPromise, children }: AuthSessionClientProviderProps) {
  // refreshSession が決めた利用者。Provider の寿命の間 userPromise より優先する(進行中の古い promise の値へ戻らない)
  const [override, setOverride] = useState<{ user: SessionUser | null } | undefined>(undefined);

  const refreshSession = useCallback(async () => {
    try {
      const { user: refreshedUser } = await fetchSession();
      setOverride({ user: refreshedUser });
    } catch (error) {
      setOverride({ user: null });
      throw error;
    }
  }, []);

  const value: AuthSessionSource = useMemo(() => ({ userPromise, override, refreshSession }), [userPromise, override, refreshSession]);

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
      {/* 利用者を読む副作用は Suspense の内側の子で(Provider と children はセッションを待たない)。
          children の後に置き、effect の順(children の effect の後)を Provider が持っていた時と同じに保つ */}
      <Suspense fallback={null}>
        <AuthSessionEffects />
      </Suspense>
    </AuthSessionContext.Provider>
  );
}

/** セッションの利用者に合わせる副作用(Firebase Auth との同期・DAU の記録)。何も描かない */
function AuthSessionEffects() {
  const { user } = useAuthSession();

  // Firebase Auth とローカルセッションの同期を維持する。
  useFirebaseAuthSync(user);

  // DAU（日次アクティブユーザー）を記録する（1日1回）。分析の機能が閉じていれば記録しない（null を渡すと何もしない）
  const dauOpen = useGate().enabled("analytics");
  useDauTracker(dauOpen ? user : null);

  return null;
}
