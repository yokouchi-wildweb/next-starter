import { cookies } from "next/headers";

import { readRedirectToast } from "@/lib/redirectToast/services/server/redirectToastCookie";

import { RedirectToastClient } from "./RedirectToastClient";

export async function RedirectToastProvider() {
  const cookieStore = await cookies();
  const toast = readRedirectToast(cookieStore);

  return <RedirectToastClient toast={toast} />;
}
