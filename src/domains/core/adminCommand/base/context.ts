// src/lib/adminCommand/core/context.ts

"use client";

import { createContext, useContext } from "react";
import type { AdminCommandContextValue } from "./types";

export const AdminCommandContext = createContext<AdminCommandContextValue | null>(null);

/**
 * 管理者コマンドの Context を利用するフック
 */
export function useAdminCommand(): AdminCommandContextValue {
  const context = useContext(AdminCommandContext);
  if (!context) {
    throw new Error("useAdminCommand must be used within AdminCommandProvider");
  }
  return context;
}
