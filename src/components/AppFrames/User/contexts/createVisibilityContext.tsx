"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** スマホ / PC ごとの表示状態 */
export type DeviceVisibility = {
  sp: boolean;
  pc: boolean;
};

export type VisibilityContextValue<T extends DeviceVisibility = DeviceVisibility> = {
  /** 実際に使う表示状態 = 基本の値に、登録された上書きを登録順に重ねたもの */
  visibility: T;
  /** 基本の値を部分更新する */
  setVisibility: (visibility: Partial<T>) => void;
  /** 基本の値を既定に戻す(setOverride で登録された上書きは消さない) */
  reset: () => void;
  /**
   * 呼び出し元ごとの上書きを登録・更新する(id は useId 等で呼び出し元ごとに一意)。
   * 初回登録の順で重なり、後から登録した上書きが優先される
   */
  setOverride: (id: string, visibility: Partial<T>) => void;
  /** 自分の上書きだけを外す(他の呼び出し元の上書きは残る) */
  clearOverride: (id: string) => void;
};

type OverrideEntry<T> = { id: string; visibility: Partial<T> };

/**
 * ヘッダー / フッター等の表示制御 Context を作る。
 *
 * Hide* コンポーネントはアンマウント時に「自分の上書きだけ」を外すため、
 * ページ遷移の退出アニメーション中に旧ページの Hide* が後から外れても、
 * 新ページの Hide* の指定は残る(全体を reset していた頃の取り合いを防ぐ)。
 */
export function createVisibilityContext<T extends DeviceVisibility>(
  name: string,
  defaultVisibility: T,
) {
  const Context = createContext<VisibilityContextValue<T> | null>(null);
  Context.displayName = `${name}VisibilityContext`;

  const Provider = ({ children }: { children: ReactNode }) => {
    const [base, setBase] = useState<T>(defaultVisibility);
    const [overrides, setOverrides] = useState<OverrideEntry<T>[]>([]);

    const setVisibility = useCallback((partial: Partial<T>) => {
      setBase((prev) => ({ ...prev, ...partial }));
    }, []);

    const reset = useCallback(() => {
      setBase(defaultVisibility);
    }, []);

    const setOverride = useCallback((id: string, partial: Partial<T>) => {
      setOverrides((prev) => {
        const index = prev.findIndex((entry) => entry.id === id);
        if (index === -1) {
          return [...prev, { id, visibility: partial }];
        }
        const next = [...prev];
        next[index] = { id, visibility: partial };
        return next;
      });
    }, []);

    const clearOverride = useCallback((id: string) => {
      setOverrides((prev) => prev.filter((entry) => entry.id !== id));
    }, []);

    const visibility = useMemo(
      () => overrides.reduce<T>((acc, entry) => ({ ...acc, ...entry.visibility }), base),
      [base, overrides],
    );

    const value = useMemo(
      () => ({ visibility, setVisibility, reset, setOverride, clearOverride }),
      [visibility, setVisibility, reset, setOverride, clearOverride],
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
  };
  Provider.displayName = `${name}VisibilityProvider`;

  const useVisibility = (): VisibilityContextValue<T> => {
    const context = useContext(Context);
    if (!context) {
      throw new Error(`use${name}Visibility must be used within ${name}VisibilityProvider`);
    }
    return context;
  };

  return { Provider, useVisibility };
}
