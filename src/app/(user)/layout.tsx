import type { ReactNode } from "react";

import { UserAppLayout } from "@/components/UserAppLayout";

export default function UserLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <UserAppLayout>{children}</UserAppLayout>;
}
