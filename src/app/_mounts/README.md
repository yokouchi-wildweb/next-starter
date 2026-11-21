# src/app/_mounts

## Overview

- root layout(`src/app/layout.tsx`)がアプリに 1 度だけ描く、子を包まない部品の置き場(Provider のように子を包む物は `src/wiring/AppProviders.tsx`)
- 棚(`src/components`)は SDK と SDK を包む lib(`@/lib/firebase` など)を値で読まない(lint `import-boundaries/shelf-purity`)。それを読む常駐の部品はここに置く
- 部品: `FirebaseAnalytics`(送ってよいとき = `@/lib/analyticsConsent` の allowed のとき、ルートの遷移ごとに page_view を 1 回送る。`@/lib/firebase/client` の `trackPageView`。説明は `src/lib/firebase/README.md`)

## Usage

- 読むのは root layout だけ(`./_mounts/<部品>`)。画面や部品からは読まない
