// src/app/(user)/(protected)/profile/edit/page.tsx

import { notFound } from "next/navigation";

import UserProfileEdit from "@/features/user/components/UserProfileEdit";
import { requireCurrentUser } from "@/features/user/services/server/requireCurrentUser";

export default async function UserProfileEditPage() {
  const user = await requireCurrentUser();

  return <UserProfileEdit user={user} />;
}
