// src/lib/x/tweets.ts

import type { SendTweetV2Params, TweetV2PostTweetResult, TwitterApi } from "twitter-api-v2";

import type { XPostOptions, XPostResult } from "./types";

/**
 * ツイートを投稿する。
 *
 * @param client - 認証済み TwitterApi クライアント
 * @param text - ツイート本文
 * @param options - リプライ、引用、メディア、投票などのオプション
 * @returns 投稿結果（id, text）
 */
export async function postTweet(
  client: TwitterApi,
  text: string,
  options?: XPostOptions,
): Promise<XPostResult> {
  const params = options ? buildTweetParams(options) : undefined;
  const result: TweetV2PostTweetResult = await client.v2.tweet(text, params);

  return {
    id: result.data.id,
    text: result.data.text,
  };
}

/**
 * メディア付きツイートを投稿する。
 * メディアは事前に uploadMedia でアップロード済みのIDを渡す。
 *
 * @param client - 認証済み TwitterApi クライアント
 * @param text - ツイート本文
 * @param mediaIds - アップロード済みメディアID（最大4件）
 * @param options - その他のオプション
 */
export async function postTweetWithMedia(
  client: TwitterApi,
  text: string,
  mediaIds: string[],
  options?: Omit<XPostOptions, "mediaIds">,
): Promise<XPostResult> {
  return postTweet(client, text, { ...options, mediaIds });
}

/**
 * ツイートを削除する。
 *
 * @param client - 認証済み TwitterApi クライアント
 * @param tweetId - 削除するツイートのID
 */
export async function deleteTweet(
  client: TwitterApi,
  tweetId: string,
): Promise<void> {
  await client.v2.deleteTweet(tweetId);
}

/**
 * リプライ用のオプションを構築する。
 * postTweet の options にスプレッドして使用。
 *
 * @param replyToTweetId - リプライ先のツイートID
 */
export function buildReplyOptions(replyToTweetId: string): Pick<XPostOptions, "replyToTweetId"> {
  return { replyToTweetId };
}

/**
 * 引用ツイート用のオプションを構築する。
 * postTweet の options にスプレッドして使用。
 *
 * @param quoteTweetId - 引用するツイートのID
 */
export function buildQuoteOptions(quoteTweetId: string): Pick<XPostOptions, "quoteTweetId"> {
  return { quoteTweetId };
}

/**
 * XPostOptions を twitter-api-v2 の SendTweetV2Params に変換する。
 */
function buildTweetParams(options: XPostOptions): Partial<SendTweetV2Params> {
  const params: Partial<SendTweetV2Params> = {};

  if (options.replyToTweetId) {
    params.reply = { in_reply_to_tweet_id: options.replyToTweetId };
  }

  if (options.quoteTweetId) {
    params.quote_tweet_id = options.quoteTweetId;
  }

  if (options.mediaIds?.length) {
    params.media = {
      media_ids: options.mediaIds as NonNullable<SendTweetV2Params["media"]>["media_ids"],
    };
  }

  if (options.poll) {
    params.poll = {
      options: options.poll.options,
      duration_minutes: options.poll.durationMinutes,
    };
  }

  return params;
}
