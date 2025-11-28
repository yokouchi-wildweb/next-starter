// src/app/(user)/(protected)/profile/edit/page.tsx

import { notFound } from "next/navigation";

import UserProfileEdit from "@/features/core/user/components/UserProfileEdit";
import { requireCurrentUser } from "@/features/core/user/services/server/requireCurrentUser";

export default async function UserProfileEditPage() {
  const user = await requireCurrentUser();

  return <UserProfileEdit user={user} />;
}
