---
paths:
  - "src/lib/firestore/**"
---
# lib/firestore
what: the client-side Firestore application layer over the SDK instance of src/lib/firebase: subscriptions, single-document operations, chunked batches, transactions, Timestamp conversion and error normalization | entry @/lib/firestore/client
use: always
change: none → /order <direct parent>
rules:
using:
- firestore_caller: a domain's ClientService calls this lib | hooks reach it only through the ClientService
- firestore_sdk_direct: read src/lib/firebase/* directly only for SDK options this lib does not cover
read: call path → Usage | functions → API | SDK init → Related
