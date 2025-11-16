export type RedirectToastVariant = "success" | "info" | "warning" | "error";

export type RedirectToastPayload = {
  message: string;
  variant: RedirectToastVariant;
};
