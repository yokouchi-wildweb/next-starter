import type { RedirectToastPayload } from "@/lib/redirectToast/types";

export type RedirectRule = {
  sourcePaths: string[];
  destination: string;
  toast: RedirectToastPayload;
};

export const redirectRules: RedirectRule[] = [
  {
    sourcePaths: ["/login", "/signup"],
    destination: "/",
    toast: {
      message: "すでにログイン済みです。",
      variant: "info",
    },
  },
];
