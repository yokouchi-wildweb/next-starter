import type { Metadata } from "next";

import { seoConfig } from "@/config/seo.config";

/**
 * createMetadataの引数
 */
export type CreateMetadataParams = {
  /** ページタイトル（必須） */
  title: string;
  /** ページの説明文（必須） */
  description: string;
  /** OGP画像のパス（省略時はデフォルト画像） */
  image?: string;
  /** 検索エンジンからの除外（true: noindex, nofollow） */
  noIndex?: boolean;
};

/**
 * ページのメタデータを生成するヘルパー関数
 *
 * @example
 * // 静的ページ
 * export const metadata = createMetadata({
 *   title: "会社概要",
 *   description: "私たちのサービスについてご紹介します。",
 * });
 *
 * @example
 * // 動的ページ
 * export async function generateMetadata({ params }: Props): Promise<Metadata> {
 *   const product = await getProduct(params.id);
 *   return createMetadata({
 *     title: product.name,
 *     description: product.description,
 *     image: product.ogImage,
 *   });
 * }
 */
export function createMetadata(params: CreateMetadataParams): Metadata {
  const { title, description, image, noIndex } = params;

  const ogImage = image || seoConfig.defaultOgImage;
  const ogImageUrl = ogImage.startsWith("http")
    ? ogImage
    : `${seoConfig.siteUrl}${ogImage.startsWith("/") ? "" : "/"}${ogImage}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: seoConfig.siteName,
      locale: seoConfig.locale,
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: seoConfig.ogImageSize.width,
          height: seoConfig.ogImageSize.height,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
      ...(seoConfig.twitterHandle ? { creator: `@${seoConfig.twitterHandle}` } : {}),
    },
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  };
}
