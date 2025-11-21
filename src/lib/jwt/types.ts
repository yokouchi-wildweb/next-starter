// src/lib/jwt/form.ts

/**
 * JWT ペイロードに含めるクレームのベース型。
 */
export type SessionTokenClaims<TUserClaims> = TUserClaims & {
  /** ISO 8601 形式の有効期限 */
  expiresAt: string;
};

/**
 * JWT 署名時に指定できるオプション。
 */
export type SignUserTokenOptions = {
  /** 有効期限（秒）。未指定の場合はデフォルト値を利用する。 */
  maxAge?: number;
  /** 発行日時を固定したい場合に指定する。 */
  issuedAt?: Date;
};

/**
 * `signUserToken` の入力。
 */
export type SignUserTokenParams<TUserClaims> = {
  /** `sub` として利用する識別子。 */
  subject: string;
  /** ペイロードに含める任意のクレーム。 */
  claims: TUserClaims;
  /** 発行時のオプション。 */
  options?: SignUserTokenOptions;
};

/**
 * `signUserToken` の戻り値。
 */
export type SignUserTokenResult<TUserClaims> = {
  /** 署名済み JWT。 */
  token: string;
  /** 有効期限。 */
  expiresAt: Date;
  /** 署名に利用したペイロード。 */
  payload: SessionTokenClaims<TUserClaims>;
};

/**
 * `verifyUserToken` の戻り値。
 */
export type VerifyUserTokenResult<TUserClaims> =
  | {
      /** `sub` クレーム。存在しない場合は `null`。 */
      subject: string | null;
      /** 検証後のクレーム。 */
      claims: TUserClaims;
      /** 有効期限。 */
      expiresAt: Date;
    }
  | null;

export type VerifyUserTokenOptions<TUserClaims> = {
  /** 現在時刻を擬似的に指定したい場合に利用する。 */
  currentDate?: Date;
  /**
   * ペイロードからドメイン固有のクレーム型へ正規化する関数。
   * `null` を返した場合は検証失敗とみなす。
   */
  claimsParser?: (payload: SessionTokenClaims<Record<string, unknown>>) => TUserClaims | null;
};
