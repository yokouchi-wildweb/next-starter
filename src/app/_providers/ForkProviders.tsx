// src/app/_providers/ForkProviders.tsx
//
// fork が自分の Provider を足す口(D30 K8)。上流は空で出荷し、src/wiring/AppProviders.tsx が一番内側でこれを包む。
// fork はこのファイルを書き換える(受け口: src/lib/forkOwnership/intake.txt)。多段の Tier も同じファイルを書き換える
// (fork ID は付けない。親の Tier の Provider を残すかは下の Tier が決める)。
//
// 書き方: client の Provider を import して children を包む(このファイル自体は server component のまま。
// "use client" の Provider は client 境界になる)。ここでデータを取らない(サーバーのデータは loader から props で)。
//
//   import { ThemeProvider } from "@/features/myTheme/components/ThemeProvider";
//   export function ForkProviders({ children }: Readonly<{ children: ReactNode }>) {
//     return <ThemeProvider>{children}</ThemeProvider>;
//   }

import type { ReactNode } from "react";

export function ForkProviders({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
