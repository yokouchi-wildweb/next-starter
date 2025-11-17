// src/app/(user)/(protected)/profile/edit/page.tsx

import { notFound } from "next/navigation";

import { authGuard } from "@/features/auth/services/server/authorization";
import UserProfileEdit from "@/features/user/components/UserProfileEdit";
import { userService } from "@/features/user/services/server/userService";

export default async function UserProfileEditPage() {
  const sessionUser = await authGuard({ allowRoles: ["admin", "user"] });

  if (!sessionUser) {
    notFound();
  }

  const user = await userService.get(sessionUser.userId);

  if (!user) {
    notFound();
  }

  return <UserProfileEdit user={user} />;
}
