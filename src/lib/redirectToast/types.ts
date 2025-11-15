export type RedirectToastType = "success" | "error" | "warning" | "info" | "default";

export type RedirectToastPayload = {
  type: RedirectToastType;
  message: string;
};
