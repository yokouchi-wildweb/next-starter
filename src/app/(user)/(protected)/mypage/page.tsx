// src/app/(user)/(protected)/mypage/page.tsx

import { notFound } from "next/navigation";

import UserMyPageView from "@/features/user/components/UserMyPage";
import { requireCurrentUser } from "@/features/user/services/server/requireCurrentUser";

export default async function UserMyPagePage() {
  const user = await requireCurrentUser();

  return <UserMyPageView user={user} />;
}
