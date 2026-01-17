import { DEFAULT_TOKEN_TTL_MS } from "./constants";
import type { IssueTokenOptions, TransitionToken } from "./types";

/**
 * 遷移トークンを生成する
 */
export function issueToken(
  targetPath: string,
  options?: IssueTokenOptions
): TransitionToken {
  const now = Date.now();
  const token: TransitionToken = {
    id: crypto.randomUUID(),
    targetPath,
    expiresAt: now + (options?.ttl ?? DEFAULT_TOKEN_TTL_MS),
    createdAt: now,
  };

  if (options?.key) {
    token.key = options.key;
  }

  return token;
}
