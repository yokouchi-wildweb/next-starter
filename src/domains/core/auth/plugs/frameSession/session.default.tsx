// src/domains/core/auth/plugs/frameSession/session.default.tsx
// 点 frameSession(枠のログインの状態とログアウト、ちょうど 1 つ、宣言 src/app/_layout/extensionPoints.ts)に差す上流の既定。常設の auth が差す(D53)。
// 呼び手は隣の 1 行スイッチ ./session.ts(fork は差替点 authFrameSession で ./session.replace.tsx に替える)。枠は src/app/_layout/useFrameSession.ts で読む

"use client";


import { useAuthSession } from "../../hooks/useAuthSession";
import { useLogout } from "../../hooks/useLogout";
import type { FrameSessionPlug } from "@/app/_layout/points";

export const plug: FrameSessionPlug = {
  useSession: () => {
    const { isAuthenticated } = useAuthSession();
    return { isAuthenticated };
  },
  useLogout: ({ redirectTo }) => {
    const { logout, isLoading } = useLogout({ redirectTo });
    return { logout, isLoading };
  },
};
