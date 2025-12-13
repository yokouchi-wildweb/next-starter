// src/lib/adminCommand/core/AdminCommandProvider.tsx

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { plugins } from "../config/plugins";
import { AdminCommandContext } from "./context";
import { AdminCommandPalette } from "./AdminCommandPalette";
import type { AdminCommandContextValue } from "./types";

type AdminCommandProviderProps = {
  children: React.ReactNode;
};

/**
 * 管理者コマンドパレットの Provider
 * - ショートカットキー監視
 * - パレット表示制御
 * - プラグインの自動適用
 */
export function AdminCommandProvider({ children }: AdminCommandProviderProps) {
  const { user } = useAuthSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const isAdmin = user?.role === "admin";

  // ショートカットキーの監視
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + Alt + A (Windows/Linux)
      // Cmd + Shift + Option + A (Mac)
      const isMac = /mac/i.test(navigator.userAgent);
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;

      if (modifierKey && e.shiftKey && e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();

        if (isAdmin) {
          // 管理者の場合はパレットを開く
          setIsOpen((prev) => !prev);
        } else {
          // 管理者でない場合はログインページに遷移
          router.push("/admin/login");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAdmin, router]);

  const openPalette = useCallback(() => setIsOpen(true), []);
  const closePalette = useCallback(() => setIsOpen(false), []);
  const togglePalette = useCallback(() => setIsOpen((prev) => !prev), []);

  const contextValue = useMemo<AdminCommandContextValue>(
    () => ({
      openPalette,
      closePalette,
      togglePalette,
      isOpen,
    }),
    [openPalette, closePalette, togglePalette, isOpen]
  );

  // コンテンツ: パレット + GlobalComponents
  const content = (
    <>
      {children}
      {isAdmin && <AdminCommandPalette open={isOpen} onOpenChange={setIsOpen} />}
      {/* プラグインの GlobalComponent を描画 */}
      {isAdmin &&
        plugins.map(
          (plugin) =>
            plugin.GlobalComponent && <plugin.GlobalComponent key={plugin.id} />
        )}
    </>
  );

  // プラグインの Provider でラップ
  const wrappedContent = plugins
    .filter((plugin) => plugin.Provider)
    .reduceRight(
      (acc, plugin) => {
        const PluginProvider = plugin.Provider!;
        return <PluginProvider key={plugin.id}>{acc}</PluginProvider>;
      },
      content
    );

  return (
    <AdminCommandContext.Provider value={contextValue}>
      {wrappedContent}
    </AdminCommandContext.Provider>
  );
}
