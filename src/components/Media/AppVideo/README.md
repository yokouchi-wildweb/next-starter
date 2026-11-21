# AppVideo

## Overview

- アプリのファイルの動画を出す部品 `AppVideo`(`@/components/Media/AppVideo`、"use client")。`<video>` と非公開ファイルの復帰を持つ唯一の置き場
- 使う所: DetailModal の動画(`media.type: "video"`)、mediaInputSuite の `VideoPreview`(入力欄の下見)、チャットの動画のメッセージ
- 使う時の決まりは札 .claude/rules/items/components/Media.md にある

## Usage

```tsx
import { AppVideo } from "@/components/Media/AppVideo";

<AppVideo src={message.content} alt="添付の動画" className="w-full max-h-80 rounded-md" />
```

- `src` には保存値(`storage://` の ref)をそのまま渡してよい。部品の中で表示用 URL に直す(呼び手は直さない)
- 失敗の表示を自分で出したい呼び手は `onError` を受ける(復帰で引き取った失敗では呼ばれない)

## API

| prop | 型 | 既定 | 説明 |
|------|----|------|------|
| `src` | `string \| null \| undefined` | 必須 | 動画の URL または `storage://` の ref。空なら src なしで描く |
| `poster` | `string \| null` | - | 表紙の画像の URL または ref |
| `alt` | `string` | - | `aria-label` と、video を描けない環境の代わりの文 |
| `controls` | `boolean` | `true` | 操作の UI |
| `muted` / `loop` | `boolean` | - | video の属性そのまま |
| `preload` | `"none" \| "metadata" \| "auto"` | - | video の属性そのまま |
| `fit` | `"contain" \| "cover"` | `"contain"` | `object-contain` / `object-cover` の class |
| `className` / `style` | - | - | video 要素に付く |
| `onLoadedMetadata` | `(video: HTMLVideoElement) => void` | - | メタデータを読めた時(復帰の位置戻しの後) |
| `onError` | `() => void` | - | 読み込みの失敗を復帰で引き取れなかった時(復帰の対象外の URL か、復帰が止まった時) |

- 描く物: `<video data-component="AppVideo">` と、復帰が止まった時だけその下の失敗の行(「動画を読み込めませんでした」+「再開」、中央寄せ)。外側の箱は無い(枠は呼び手が持つ)

## Internals

- ref → URL は `toStorageDisplaySrc`(`@/lib/storage`)。非公開は固定 URL `/api/storage/objects/<id>`、公開は公開の URL、ref 以外はそのまま
- 復帰は `usePrivateMediaRecovery(src, videoRef)`(src/lib/storage/Internals.md「非公開の動画・音声」)。`videoProps` を video に広げ、`onError` と `onLoadedMetadata` だけは個別の `handleError` / `handleLoadedMetadata` で包む(`handleError` の真偽で呼び手の `onError` を呼ぶか決める)
- 固定 URL でない src では復帰は何もせず、素の video と同じに動く
- `status === "failed"` で失敗の行を出し、「再開」は `resume()`(最後に覚えた位置で読み直す)
- src は `<source>` 子要素でなく video に付ける(`<source>` だと読み込み失敗の error が video の onError に届かない)

## Verification

- `pnpm test src/components/Media/AppVideo`(ref の解決・属性・既定の出力)
