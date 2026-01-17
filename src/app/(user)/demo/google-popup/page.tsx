"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
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
  // Google プロフィールの表示名。未設定の場合は null。
  displayName: string | null;
  // Google アカウントのメールアドレス。非公開の可能性があるため null の場合も。
  email: string | null;
  // プロフィール画像の URL。
  photoURL: string | null;
  // 接続済みの認証プロバイダー ID 一覧。
  providerIds: string[];
  // メールアドレスの確認が完了しているかどうか。
  isEmailVerified: boolean;
  // Firebase のバックエンド認証などで利用する ID トークン。
  idToken: string;
  metadata: {
    // アカウントが最初に作成された日時。
    creationTime: string | null;
    // 最後にサインインした日時。
    lastSignInTime: string | null;
  };
};

// Google 認証で取得できる OAuth 資格情報も画面表示向けに整形します。
type OAuthCredentialSnapshot = {
  // どの OAuth プロバイダーの資格情報か (google.com など)。
  providerId: string;
  // OAuth フローの方式 (redirect/popup 等)。提供されない場合もあるため null。
  signInMethod: string | null;
  // Google API にアクセスするためのアクセストークン。scope によっては含まれない。
  accessToken: string | null;
  // OpenID Connect の ID トークン。リクエスト内容によっては null。
  idToken: string | null;
};

// Firebase の User インスタンスから UserSnapshot を生成する補助関数。
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

// OAuthCredential から画面表示用のスナップショットを作る補助関数。
function createOAuthSnapshot(
  credential: ReturnType<typeof GoogleAuthProvider.credentialFromResult>,
): OAuthCredentialSnapshot | null {
  // GoogleAuthProvider.credentialFromResult が null を返した場合は資格情報なし。
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

export default function GooglePopupAuthDemoPage() {
  // 画面表示に必要なデータはすべて useState で管理します。
  const [userSnapshot, setUserSnapshot] = useState<UserSnapshot | null>(null);
  const [oauthCredential, setOauthCredential] = useState<OAuthCredentialSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false); // ボタン操作中かどうか
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Firebase Auth のサインイン状態を監視し、ユーザー情報が変わったら
  // 最新の情報を画面に反映します。
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // user が null なら未サインインの状態。
      if (!user) {
        setUserSnapshot(null);
        return;
      }

      try {
        // ID トークンはバックエンド API への認証などで使うので、
        // ここで取得しておくとサンプルとしてわかりやすくなります。
        const idToken = await user.getIdToken();
        setErrorMessage(null);
        setUserSnapshot(createUserSnapshot(user, idToken));
      } catch (unknownError: unknown) {
        if (unknownError instanceof FirebaseError) {
          setErrorMessage(`ID トークンの取得に失敗しました: ${unknownError.message}`);
        } else if (unknownError instanceof Error) {
          setErrorMessage(`ID トークンの取得に失敗しました: ${unknownError.message}`);
        } else {
          setErrorMessage("ID トークンの取得に失敗しました (不明なエラー)");
        }
      }
    });

    // イベントリスナーはコンポーネントのアンマウント時に必ず解除します。
    return () => unsubscribe();
  }, []);

  // "Google でサインイン" ボタンを押した時の処理。
  const handleSignIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // signInWithPopup はポップアップで Google 認証を実行し、完了すると
      // 同じ画面に制御が戻ってきます。
      const credential = await signInWithPopup(auth, provider);
      setOauthCredential(createOAuthSnapshot(GoogleAuthProvider.credentialFromResult(credential)));
    } catch (unknownError: unknown) {
      // FirebaseError なら Firebase SDK 側のエラー。
      if (unknownError instanceof FirebaseError) {
        setErrorMessage(`Firebase エラー (${unknownError.code}): ${unknownError.message}`);
      // それ以外の Error インスタンスは一般的な JS エラー。
      } else if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message);
      } else {
        setErrorMessage("不明なエラーが発生しました");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // サインアウトボタンを押した時の処理。Firebase 側のセッションも破棄されます。
  const handleSignOut = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await signOut(auth);
      setOauthCredential(null);
    } catch (unknownError: unknown) {
      // FirebaseError は SDK 側のサインアウト失敗。
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
    <Stack className="py-8" space={10}>
      <header className="flex flex-col gap-3">
        <PageTitle size="xxxl" className="font-semibold tracking-tight">
          Google ポップアップ認証デモ
        </PageTitle>
        <Para tone="muted">
          Firebase Authentication の Google プロバイダーをポップアップ方式で呼び出し、戻り先の画面で認証結果をそのまま確認できるデモです。
        </Para>
      </header>

      <Section className="flex flex-col gap-4">
        <SecTitle as="h2">操作</SecTitle>
        <Para size="sm">
          「Google でサインイン」を押すとポップアップで認証が行われ、完了するとこの画面に認証情報が表示されます。
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
        {errorMessage ? (
          <Para tone="error" size="sm">
            {errorMessage}
          </Para>
        ) : null}
      </Section>

      {/* -------------------------------------------------------------- */}
      {/* 以下は取得した情報の表示パート。UI はお好みで調整してください。 */}
      {/* -------------------------------------------------------------- */}
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
            まだサインインしていません。ポップアップで認証を完了するとここにユーザー情報が表示されます。
          </Para>
        )}
      </Section>

      <Section className="flex flex-col gap-4">
        <SecTitle as="h2">ポップアップで取得した OAuth 認証情報</SecTitle>
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
            直近のポップアップ認証で取得した OAuth 資格情報がここに表示されます。
          </Para>
        )}
      </Section>
    </Stack>
  );
}
