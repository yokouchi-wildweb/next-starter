// src/app/(user)/(protected)/mypage/page.tsx

import { notFound } from "next/navigation";

import { authGuard } from "@/features/auth/services/server/authorization";
import UserMyPageView from "@/features/user/components/UserMyPage";
import { userService } from "@/features/user/services/server/userService";

export default async function UserMyPagePage() {
  const sessionUser = await authGuard({ allowRoles: ["admin", "user"] });

  if (!sessionUser) {
    notFound();
  }

  const user = await userService.get(sessionUser.userId);

  if (!user) {
    notFound();
  }

  return <UserMyPageView user={user} />;
}
