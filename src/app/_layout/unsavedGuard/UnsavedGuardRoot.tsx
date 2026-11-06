// src/app/_layout/unsavedGuard/UnsavedGuardRoot.tsx
// 未保存の編集の守り(src/lib/unsavedGuard)の既定の結線: 確認 = Overlays の Dialog(lib は見た目を持たず確認の関数を値で受ける)、
// 文は理由ごとに src/config/ui/unsaved-guard.config.ts から(立っている理由が複数なら lib の pickConfirmReason = 処理の途中が勝つ)、
// 守りを棚の Navigation の口(Link の移動の判定・棚の router・AppForm の編集済みの元)へ入れる(棚は lib を読まない、D50)。
// 門番の口(GateProvider → LinkVisibilityProvider)と同じ置き方。AppProviders(server)が 1 か所で描く。
// 確認の開閉に state を持つのでクライアント側の部品になり、server の入れ子 AppProviders には書けない → root の layout の部品
// (管理コマンドの AdminCommandRoot と同じ置き場)。wiring には置かない(wiring どうしは import しない)

"use client";

import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";

import { NavigationPortProvider, type NavigationPortValue } from "@/components/Navigation/NavigationPort";
import { Dialog } from "@/components/Overlays/Dialog";
import { UNSAVED_GUARD_CONFIRM } from "@/config/ui/unsaved-guard.config";
import {
  NAVIGATION_PORT_ATTR,
  pickConfirmReason,
  UnsavedGuardProvider,
  useLinkNavigateJudge,
  useRouter,
  useUnsavedSourceFactory,
  type ConfirmLeave,
  type UnsavedReason,
} from "@/lib/unsavedGuard";

const LINK_ATTRIBUTES = { [NAVIGATION_PORT_ATTR]: "" };

/** lib の守りを棚の口へ入れる */
function NavigationPortBridge({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const judgeLink = useLinkNavigateJudge();
  const createUnsavedSource = useUnsavedSourceFactory();
  const value = useMemo<NavigationPortValue>(
    () => ({ router, judgeLink, linkAttributes: LINK_ATTRIBUTES, createUnsavedSource }),
    [router, judgeLink, createUnsavedSource],
  );
  return <NavigationPortProvider value={value}>{children}</NavigationPortProvider>;
}

export function UnsavedGuardRoot({ children }: Readonly<{ children: ReactNode }>) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<UnsavedReason>("unsaved");
  const resolveRef = useRef<((leave: boolean) => void) | null>(null);
  const settle = useCallback((leave: boolean) => {
    resolveRef.current?.(leave);
    resolveRef.current = null;
    setOpen(false);
  }, []);
  const confirm = useCallback<ConfirmLeave>(
    (request) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setReason(pickConfirmReason(request.reasons));
        setOpen(true);
      }),
    [],
  );
  const texts = UNSAVED_GUARD_CONFIRM[reason];
  return (
    <UnsavedGuardProvider confirm={confirm}>
      <NavigationPortBridge>{children}</NavigationPortBridge>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) settle(false);
        }}
        title={texts.title}
        description={texts.description}
        confirmLabel={texts.confirmLabel}
        cancelLabel={texts.cancelLabel}
        confirmVariant="destructive"
        onConfirm={() => settle(true)}
        layer="apex"
        overlayLayer="apex"
      />
    </UnsavedGuardProvider>
  );
}
