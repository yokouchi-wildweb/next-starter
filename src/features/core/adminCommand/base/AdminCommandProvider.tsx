// src/lib/adminCommand/core/AdminCommandProvider.tsx

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { getRoleCategory } from "@/features/core/user/constants";
import { AdminCommandContext } from "./context";
import { AdminCommandPalette } from "./AdminCommandPalette";
import { type AdminCommandLists, loadForAdmin, type LoadedAdminCommand } from "./loadForAdmin";
import type { AdminCommandContextValue } from "./types";

type AdminCommandProviderProps = AdminCommandLists & {
  children: React.ReactNode;
};

/**
 * 管理者コマンドパレットの Provider
 * - ショートカットキー監視
 * - パレット表示制御
 * - 管理者になってからカテゴリ・プラグインを読み込む
 */
export function AdminCommandProvider({ children, categories, plugins }: AdminCommandProviderProps) {
  const { user } = useAuthSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const isAdmin = getRoleCategory(user?.role ?? "") === "admin";
  const [loaded, setLoaded] = useState<LoadedAdminCommand | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadForAdmin(isAdmin, { categories, plugins })
      .then((result) => {
        if (!cancelled) setLoaded(result);
      })
      .catch((err) => console.error("[AdminCommand] 読み込みエラー:", err));
    return () => {
      cancelled = true;
    };
  }, [isAdmin, categories, plugins]);

  // ショートカットキーの監視
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + Alt + A (Windows/Linux)
      // Cmd + Shift + Option + A (Mac)
      const isMac = /mac/i.test(navigator.userAgent);
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;

      if (modifierKey && e.shiftKey && e.altKey && e.code === "KeyA") {
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

  // パレット + GlobalComponents。プラグインの Provider はここだけを包む（読み込み後に画面全体を作り直さないため）
  const adminContent = loaded && (
    <>
      <AdminCommandPalette categories={loaded.categories} open={isOpen} onOpenChange={setIsOpen} />
      {loaded.plugins.map(
        (plugin) =>
          plugin.GlobalComponent && <plugin.GlobalComponent key={plugin.id} />
      )}
    </>
  );

  const wrappedAdminContent = loaded?.plugins
    .filter((plugin) => plugin.Provider)
    .reduceRight(
      (acc, plugin) => {
        const PluginProvider = plugin.Provider!;
        return <PluginProvider key={plugin.id}>{acc}</PluginProvider>;
      },
      adminContent
    );

  return (
    <AdminCommandContext.Provider value={contextValue}>
      {children}
      {wrappedAdminContent}
    </AdminCommandContext.Provider>
  );
}
