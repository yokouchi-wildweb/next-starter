// src/wiring/UnsavedGuardWiring.tsx
// 未保存の編集の守り(src/lib/unsavedGuard)の既定の結線: 確認 = Overlays の Dialog(lib は見た目を持たず確認の関数を値で受ける)、
// 守りを棚の Navigation の口(Link の移動の判定・棚の router・AppForm の編集済みの元)へ入れる(棚は lib を読まない、D50)。
// 門番の口(GateProvider → LinkVisibilityProvider)と同じ置き方。AppProviders が 1 か所で描く

"use client";

import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";

import { NavigationPortProvider, type NavigationPortValue } from "@/components/Navigation/NavigationPort";
import { Dialog } from "@/components/Overlays/Dialog";
import {
  NAVIGATION_PORT_ATTR,
  UnsavedGuardProvider,
  useLinkNavigateJudge,
  useRouter,
  useUnsavedSourceFactory,
  type ConfirmLeave,
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

export function UnsavedGuardWiring({ children }: Readonly<{ children: ReactNode }>) {
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<((leave: boolean) => void) | null>(null);
  const settle = useCallback((leave: boolean) => {
    resolveRef.current?.(leave);
    resolveRef.current = null;
    setOpen(false);
  }, []);
  const confirm = useCallback<ConfirmLeave>(
    () =>
      new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setOpen(true);
      }),
    [],
  );
  return (
    <UnsavedGuardProvider confirm={confirm}>
      <NavigationPortBridge>{children}</NavigationPortBridge>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) settle(false);
        }}
        title="編集中の内容があります"
        description="保存していない変更は失われます。このページを離れますか？"
        confirmLabel="離れる"
        cancelLabel="留まる"
        confirmVariant="destructive"
        onConfirm={() => settle(true)}
        layer="apex"
        overlayLayer="apex"
      />
    </UnsavedGuardProvider>
  );
}
