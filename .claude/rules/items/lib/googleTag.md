---
paths:
  - "src/lib/googleTag/**"
---
# lib/googleTag
what: Google tag (gtag.js) and Google Ads conversion tracking, driven only by NEXT_PUBLIC_* env (unset = no-op); entry @/lib/googleTag (initGoogleTag, GoogleTag, useGoogleAdsConversion), root layout renders @/wiring/googleTag
use: always
change: add = channel rows as items of googleTagChannels in your own domain's plugs/ | else none → /order <direct parent> (values come from env; extra ignore-referrer paths / domains are props of @/wiring/googleTag)
rules:
using:
- ids_in_env: tag ids and conversion labels live only in env, never in source
- render_wired: the root layout renders @/wiring/googleTag (the googleTagChannels list, narrowed by the gate: closed userAcquisition = no channel rows), never the lib's GoogleTag directly
- fire_named: named conversions fire through useGoogleAdsConversion (dedup by transaction_id when given, else once per mount); a one-off fork conversion may call trackGoogleAdsConversion with its own env
- ga_admin_too: (recommended) also list the ignored referrer domains in GA4's referral exclusion settings (the code side covers only this lib's tag)
editing:
- keep_existing_gtag: reuse an existing window.gtag / dataLayer (Firebase Analytics), never overwrite it
- client_only: the lib does nothing on the server
- no_domains_config: the lib reads neither domains nor src/config; the channel table is passed in
- new_conversion: a new named conversion = one env + one GOOGLE_ADS_CONVERSIONS key + fire at its site
read: env and setup → Usage | functions → API | add a conversion → Extension | referrer and invite handling → Internals
