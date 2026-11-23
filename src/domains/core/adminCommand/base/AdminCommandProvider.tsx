// src/lib/adminCommand/core/AdminCommandProvider.tsx

"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/lib/unsavedGuard";

import { useAuthSession } from "@/domains/core/auth/hooks/useAuthSession";
import { getRoleCategory } from "@/domains/core/user/constants";
import { AdminCommandContext } from "./context";
import { AdminCommandPalette } from "./AdminCommandPalette";
import { type AdminCommandLists, loadForAdmin, type LoadedAdminCommand } from "./loadForAdmin";
import type { AdminCommandContextValue, NavigationFilter } from "./types";

type AdminCommandProviderProps = AdminCommandLists & {
  children: React.ReactNode;
};

/**
 * 管理者コマンドパレットの Provider
 * - ショートカットキー監視
 * - パレット表示制御
 * - 管理者になってからカテゴリ・プラグインを読み込む
 * - セッションは本体で読まない(Suspense の内側の AdminRoleWatcher が読んで isAdmin を渡す)。root の Provider の入れ子は
 *   殻(build で焼く最初の HTML)に入るので、本体がセッションの promise を待つと殻が作れない(注文 8・10 と同じ形)
 */
export function AdminCommandProvider({ children, categories, plugins }: AdminCommandProviderProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  // セッションを読む前は false(未ログインと同じ = 読み込まない・パレットを開かない)
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState<LoadedAdminCommand | null>(null);
  // 移動の候補の絞り込み(管理の枠の中の AdminCommandGateBridge が登録する。外では null = 絞らない)
  const [navigationFilter, setNavigationFilterState] = useState<NavigationFilter | null>(null);
  const setNavigationFilter = useCallback((filter: NavigationFilter | null) => setNavigationFilterState(() => filter), []);

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
      navigationFilter,
      setNavigationFilter,
    }),
    [openPalette, closePalette, togglePalette, isOpen, navigationFilter, setNavigationFilter]
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
      <Suspense fallback={null}>
        <AdminRoleWatcher onChange={setIsAdmin} />
      </Suspense>
    </AdminCommandContext.Provider>
  );
}

/** セッションの利用者が管理者かを Provider に伝える。何も描かない(Suspense の内側で読む) */
function AdminRoleWatcher({ onChange }: Readonly<{ onChange: (isAdmin: boolean) => void }>) {
  const { user } = useAuthSession();
  const isAdmin = getRoleCategory(user?.role ?? "") === "admin";
  useEffect(() => {
    onChange(isAdmin);
  }, [isAdmin, onChange]);
  return null;
}
