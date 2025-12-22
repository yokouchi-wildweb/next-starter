"use client";

import Image from "next/image";
import Link from "next/link";

import {
  HEADER_LOGO,
  HEADER_LOGO_LINK,
  HEADER_TEXT_LOGO,
} from "@/config/ui/user-header.config";

/**
 * ロゴ画像のURLを取得（フォールバック対応）
 * - 指定モードの画像がない場合、もう一方のモードの画像を使用
 */
const getLightLogoUrl = (): string | null => {
  return HEADER_LOGO.light ?? HEADER_LOGO.dark;
};

const getDarkLogoUrl = (): string | null => {
  return HEADER_LOGO.dark ?? HEADER_LOGO.light;
};

/** テキストロゴ（画像未設定時に表示） */
const TextLogo = () => (
  <>
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold uppercase text-primary-foreground sm:h-10 sm:w-10 sm:text-sm">
      {HEADER_TEXT_LOGO.short}
    </span>
    <span className="text-sm tracking-wide sm:text-base">
      {HEADER_TEXT_LOGO.name}
    </span>
  </>
);

/** 画像ロゴ（ダークモード/ライトモード対応） */
const ImageLogo = ({
  lightUrl,
  darkUrl,
}: {
  lightUrl: string | null;
  darkUrl: string | null;
}) => {
  // 両方同じ画像の場合は1つだけ表示
  if (lightUrl === darkUrl && lightUrl) {
    return (
      <Image
        src={lightUrl}
        alt={HEADER_TEXT_LOGO.name}
        width={160}
        height={40}
        className="h-9 w-auto sm:h-10"
        priority
      />
    );
  }

  return (
    <>
      {/* ライトモード用 */}
      {lightUrl && (
        <Image
          src={lightUrl}
          alt={HEADER_TEXT_LOGO.name}
          width={160}
          height={40}
          className="h-9 w-auto dark:hidden sm:h-10"
          priority
        />
      )}
      {/* ダークモード用 */}
      {darkUrl && (
        <Image
          src={darkUrl}
          alt={HEADER_TEXT_LOGO.name}
          width={160}
          height={40}
          className="hidden h-9 w-auto dark:block sm:h-10"
          priority
        />
      )}
    </>
  );
};

export const Brand = () => {
  const lightLogoUrl = getLightLogoUrl();
  const darkLogoUrl = getDarkLogoUrl();
  const hasImageLogo = lightLogoUrl !== null || darkLogoUrl !== null;

  return (
    <Link
      href={HEADER_LOGO_LINK}
      className="flex items-center gap-2.5 text-base font-semibold sm:gap-3 sm:text-lg"
    >
      {hasImageLogo ? (
        <ImageLogo lightUrl={lightLogoUrl} darkUrl={darkLogoUrl} />
      ) : (
        <TextLogo />
      )}
    </Link>
  );
};
