"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Section } from "@/components/Layout/Section";
import { PageTitle, Para, SecTitle } from "@/components/TextBlocks";
import { auth } from "@/lib/firebase/client/app";

// --------------------------------------------------------------
// 型定義
// --------------------------------------------------------------
// Firebase の User 型はプロパティが多いため、画面で使う項目だけを
// 抜き出した "スナップショット" を用意しておくと扱いやすくなります。
// UserSnapshot は「ログイン済みユーザー本人の情報」を扱い、
// OAuthCredentialSnapshot は「Google との認可フローで受け取る OAuth 情報」を扱う。
type UserSnapshot = {
  // Firebase が発行するユーザー固有 ID。
  uid: string;
  // Google プロフィールの表示名。設定されていない場合は null。
  displayName: string | null;
  // Google アカウントのメールアドレス。非公開なら null。
  email: string | null;
  // プロフィール画像の URL。
  photoURL: string | null;
  // 連携済みの認証プロバイダー ID 一覧。
  providerIds: string[];
  // メールアドレスの確認が完了しているか。
  isEmailVerified: boolean;
  // Firebase で保護された API を叩く際に使う ID トークン。
  idToken: string;
  metadata: {
    // アカウント作成日時。
    creationTime: string | null;
    // 最終サインイン日時。
    lastSignInTime: string | null;
  };
};

type OAuthCredentialSnapshot = {
  // どの OAuth プロバイダーかを示す ID。
  providerId: string;
  // 使用されたサインイン方法 (redirect/popup)。値が入らないこともある。
  signInMethod: string | null;
  // Google API 用のアクセストークン。scope によっては含まれない。
  accessToken: string | null;
  // OpenID Connect の ID トークン。取得できないケースもある。
  idToken: string | null;
};

function createUserSnapshot(user: User, idToken: string): UserSnapshot {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    providerIds: user.providerData.map((profile) => profile.providerId),
    isEmailVerified: user.emailVerified,
    idToken,
    metadata: {
      creationTime: user.metadata.creationTime ?? null,
      lastSignInTime: user.metadata.lastSignInTime ?? null,
    },
  };
}

function createOAuthSnapshot(
  credential: ReturnType<typeof GoogleAuthProvider.credentialFromResult>,
): OAuthCredentialSnapshot | null {
  // リダイレクト結果に OAuth 資格情報が含まれていない場合は null。
  if (!credential) {
    return null;
  }

  return {
    providerId: credential.providerId,
    signInMethod: credential.signInMethod ?? null,
    accessToken: credential.accessToken ?? null,
    idToken: credential.idToken ?? null,
  };
}

export default function GoogleRedirectAuthDemoPage() {
  const [userSnapshot, setUserSnapshot] = useState<UserSnapshot | null>(null);
  const [oauthCredential, setOauthCredential] = useState<OAuthCredentialSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingRedirectResult, setIsCheckingRedirectResult] = useState(true); // リダイレクト結果の取得中かどうか
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // React 18 の Strict Mode では useEffect が 2 回実行されるため、
  // リダイレクト結果の取得処理が重複しないようにフラグで制御します。
  const hasCheckedRedirectResult = useRef(false);

  useEffect(() => {

    // useEffect 内で await など非同期で値を取得し結果を setState で更新する場合は
    // コンポーネントのマウント状態をチェックする必要がある
    // チェック自体を useState で管理すると更新のたびに再レンダーが走り効果が薄くなるので、
    // エフェクト内で完結する一時的なミューテーブル値として let で持たせています。
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // user が null なら未サインインの状態なので情報をクリア。
      if (!user) {
        if (isMounted) {
          setUserSnapshot(null);
        }
        return;
      }

      try {
        const idToken = await user.getIdToken();

        // アンマウント後に setState を呼び出しても UI は更新されないため、
        // 不要な警告を避ける目的で早期 return する。
        if (!isMounted) {
          return;
        }

        setErrorMessage(null);
        setUserSnapshot(createUserSnapshot(user, idToken));

      } catch (unknownError: unknown) {
        // すでにアンマウント済みならエラーメッセージも更新しない。
        if (!isMounted) {
          return;
        }
        // FirebaseError は SDK が投げたエラー。
        if (unknownError instanceof FirebaseError) {
          setErrorMessage(`ID トークンの取得に失敗しました: ${unknownError.message}`);
        // Error インスタンスは一般的な JS エラー。
        } else if (unknownError instanceof Error) {
          setErrorMessage(`ID トークンの取得に失敗しました: ${unknownError.message}`);
        } else {
          setErrorMessage("ID トークンの取得に失敗しました (不明なエラー)");
        }
      }
    });

    const checkRedirectResult = async () => {
      // Strict Mode の二重実行を避けるため、一度処理したらスキップ。
      if (hasCheckedRedirectResult.current) {
        return;
      }

      hasCheckedRedirectResult.current = true;
      setIsCheckingRedirectResult(true);

      try {
        const result = await getRedirectResult(auth);
        // アンマウント後ならステート更新を行わない。
        if (!isMounted) {
          return;
        }
        setOauthCredential(createOAuthSnapshot(result ? GoogleAuthProvider.credentialFromResult(result) : null));
      } catch (unknownError: unknown) {
        // コンポーネントがすでに外れていればエラー更新もしない。
        if (!isMounted) {
          return;
        }
        // FirebaseError は Firebase SDK 由来。
        if (unknownError instanceof FirebaseError) {
          setErrorMessage(`リダイレクト結果の取得に失敗しました: ${unknownError.message}`);
        // Error インスタンスは一般的な JS エラー。
        } else if (unknownError instanceof Error) {
          setErrorMessage(`リダイレクト結果の取得に失敗しました: ${unknownError.message}`);
        } else {
          setErrorMessage("リダイレクト結果の取得に失敗しました (不明なエラー)");
        }
      } finally {
        // マウント中であればローディング表示を解除。
        if (isMounted) {
          setIsCheckingRedirectResult(false);
        }
      }
    };

    // 初回マウント時にリダイレクト結果を確認。
    void checkRedirectResult();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleSignIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // signInWithRedirect を呼び出すと、その時点でページ遷移が始まり、
      // 認証完了後にこのページへ戻ってきます。
      await signInWithRedirect(auth, provider);
    } catch (unknownError: unknown) {
      // FirebaseError なら Firebase SDK 側で発生した問題。
      if (unknownError instanceof FirebaseError) {
        setErrorMessage(`Firebase エラー (${unknownError.code}): ${unknownError.message}`);
      // Error インスタンスは一般的な JS エラー。
      } else if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message);
      } else {
        setErrorMessage("不明なエラーが発生しました");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await signOut(auth);
      setOauthCredential(null);
    } catch (unknownError: unknown) {
      // FirebaseError は SDK 側でサインアウトが失敗したケース。
      if (unknownError instanceof FirebaseError) {
        setErrorMessage(`サインアウトに失敗しました: ${unknownError.message}`);
      // Error インスタンスなら一般的なエラー。
      } else if (unknownError instanceof Error) {
        setErrorMessage(`サインアウトに失敗しました: ${unknownError.message}`);
      } else {
        setErrorMessage("サインアウトに失敗しました (不明なエラー)");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <Block className="py-8" space="xl">
      <header className="flex flex-col gap-3">
        <PageTitle size="xxxl" className="font-semibold tracking-tight">
          Google リダイレクト認証デモ
        </PageTitle>
        <Para tone="muted">
          Firebase Authentication の Google プロバイダーをリダイレクト方式で呼び出し、戻り先の画面で認証結果をそのまま確認できるデモです。
        </Para>
      </header>

      <Section className="flex flex-col gap-4">
        <SecTitle as="h2">操作</SecTitle>
        <Para size="sm">
          「Google でサインイン」を押すとリダイレクトで認証が行われ、完了するとこの画面に認証情報が表示されます。
        </Para>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={handleSignIn} disabled={isLoading}>
            {isLoading ? "処理中..." : "Google でサインイン"}
          </Button>
          {userSnapshot ? (
            <Button type="button" variant="outline" onClick={handleSignOut} disabled={isLoading}>
              サインアウト
            </Button>
          ) : null}
        </div>
        {isCheckingRedirectResult ? (
          <Para tone="muted" size="sm">
            認証が完了しているか確認しています...
          </Para>
        ) : null}
        {errorMessage ? (
          <Para tone="error" size="sm">
            {errorMessage}
          </Para>
        ) : null}
      </Section>

      <Section className="flex flex-col gap-4">
        <SecTitle as="h2">Firebase ユーザー情報</SecTitle>
        {userSnapshot ? (
          <Block>
            {userSnapshot.photoURL ? (
              <div className="flex items-center gap-4">
                <Image
                  src={userSnapshot.photoURL}
                  alt="Google アカウントのプロフィール画像"
                  width={64}
                  height={64}
                  unoptimized
                  className="h-16 w-16 rounded-full border border-border object-cover"
                />
                <div>
                  <p className="text-lg font-semibold">{userSnapshot.displayName ?? "(表示名なし)"}</p>
                  <p className="text-sm text-muted-foreground">{userSnapshot.email ?? "メールアドレスなし"}</p>
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-lg border border-border">
              <dl className="divide-y divide-border text-sm">
                <div className="grid grid-cols-1 gap-1 bg-muted/60 px-4 py-3 sm:grid-cols-3 sm:gap-3">
                  <dt className="font-semibold text-muted-foreground">ユーザー ID</dt>
                  <dd className="sm:col-span-2 break-all">{userSnapshot.uid}</dd>
                </div>
                <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-3">
                  <dt className="font-semibold text-muted-foreground">メール認証</dt>
                  <dd className="sm:col-span-2">{userSnapshot.isEmailVerified ? "済み" : "未認証"}</dd>
                </div>
                <div className="grid grid-cols-1 gap-1 bg-muted/40 px-4 py-3 sm:grid-cols-3 sm:gap-3">
                  <dt className="font-semibold text-muted-foreground">連携プロバイダー</dt>
                  <dd className="sm:col-span-2">{userSnapshot.providerIds.join(", ")}</dd>
                </div>
                <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-3">
                  <dt className="font-semibold text-muted-foreground">作成日時</dt>
                  <dd className="sm:col-span-2">{userSnapshot.metadata.creationTime ?? "(不明)"}</dd>
                </div>
                <div className="grid grid-cols-1 gap-1 bg-muted/40 px-4 py-3 sm:grid-cols-3 sm:gap-3">
                  <dt className="font-semibold text-muted-foreground">最終サインイン</dt>
                  <dd className="sm:col-span-2">{userSnapshot.metadata.lastSignInTime ?? "(不明)"}</dd>
                </div>
                <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-3">
                  <dt className="font-semibold text-muted-foreground">ID トークン</dt>
                  <dd className="sm:col-span-2 break-all text-xs">{userSnapshot.idToken}</dd>
                </div>
              </dl>
            </div>
          </Block>
        ) : (
          <Para tone="muted" size="sm">
            まだサインインしていません。リダイレクトで認証を完了するとここにユーザー情報が表示されます。
          </Para>
        )}
      </Section>

      <Section className="flex flex-col gap-4">
        <SecTitle as="h2">リダイレクトで取得した OAuth 認証情報</SecTitle>
        {oauthCredential ? (
          <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
            <dl className="divide-y divide-border text-sm">
              <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-3">
                <dt className="font-semibold text-muted-foreground">Provider ID</dt>
                <dd className="sm:col-span-2">{oauthCredential.providerId}</dd>
              </div>
              <div className="grid grid-cols-1 gap-1 bg-muted/60 px-4 py-3 sm:grid-cols-3 sm:gap-3">
                <dt className="font-semibold text-muted-foreground">Sign-in Method</dt>
                <dd className="sm:col-span-2">{oauthCredential.signInMethod ?? "(不明)"}</dd>
              </div>
              <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-3">
                <dt className="font-semibold text-muted-foreground">Access Token</dt>
                <dd className="sm:col-span-2 break-all text-xs">
                  {oauthCredential.accessToken ?? "(含まれていません)"}
                </dd>
              </div>
              <div className="grid grid-cols-1 gap-1 bg-muted/60 px-4 py-3 sm:grid-cols-3 sm:gap-3">
                <dt className="font-semibold text-muted-foreground">ID Token</dt>
                <dd className="sm:col-span-2 break-all text-xs">
                  {oauthCredential.idToken ?? "(含まれていません)"}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <Para tone="muted" size="sm">
            直近のリダイレクト認証で取得した OAuth 資格情報がここに表示されます。
          </Para>
        )}
      </Section>
    </Block>
  );
}
