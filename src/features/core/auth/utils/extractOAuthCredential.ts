// src/features/auth/utils/extractOAuthCredential.ts

import type { UserCredential } from "firebase/auth";

export type ExtractedOAuthCredential = {
  firebaseUid: string;
  idToken: string;
  providerId: string | null;
  email: string | null;
  name: string | null;
};

export async function extractOAuthCredential(
  credential: UserCredential,
): Promise<ExtractedOAuthCredential> {
  const { user } = credential;
  const providerId = credential.providerId ?? user.providerData?.[0]?.providerId ?? null;
  const idToken = await user.getIdToken();

  return {
    firebaseUid: user.uid,
    idToken,
    providerId,
    email: user.email ?? null,
    name: user.displayName ?? null,
  };
}
