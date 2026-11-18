---
paths:
  - "src/lib/storageCors/**"
---
# lib/storageCors
what: a development-only self-diagnosis that points to a missing storage CORS setting where a browser fetch or canvas export of cross-origin storage bytes fails | entry @/lib/storageCors (fetchStorageBytes, canvasToBlobSafe, diagnose*, classifyStorageUrl)
use: always
change: none → /order <direct parent>
rules:
using:
- sc_wrap: the dev notice appears only where code goes through fetchStorageBytes / canvasToBlobSafe or calls diagnoseStorageFetchError / diagnoseTaintedCanvasError in its catch → a cross-origin byte read or remote-media canvas export that wants it uses one of them
editing:
- sc_maybe: a notice names a possible cause, never asserts it (Failed to fetch has other causes)
- sc_dev_browser_only: nothing happens in production (stage via @/lib/appEnv) or outside the browser
- sc_once: one notice per URL and context
- sc_docs_primary: setup steps and premises live only in the docs/setup CORS document | the lib only points to it
read: fetch / canvas call sites → Usage | functions, bucket classes → API | notice behavior → Internals | setup document → Related
