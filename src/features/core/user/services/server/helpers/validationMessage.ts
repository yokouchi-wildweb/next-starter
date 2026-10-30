// src/features/core/user/services/server/helpers/validationMessage.ts

import { z } from "zod";

/**
 * 利用者に返す検証の文。スキーマが書いた文はそのまま、Zod の既定の文("Invalid url" など)は fallback に置き換える。
 * 既定の文かどうかは、同じ issue から Zod の既定のマップで作り直した文との一致で見る(一覧を持たない)。
 */
export function userFacingValidationMessage(issue: z.ZodIssue | undefined, fallback: string): string {
  if (!issue) return fallback;
  const { message: defaultMessage } = z.defaultErrorMap(issue as z.ZodIssueOptionalMessage, { data: undefined, defaultError: "" });
  return issue.message === defaultMessage ? fallback : issue.message;
}
