---
paths:
  - "src/components/Skeleton/**"
---
# components/Skeleton
what: loading placeholders (@/components/Skeleton/*): BaseSkeleton (one shape, wraps Primitives/Skeleton) and screen-unit skeletons built on it (FormSkeleton, DetailModalSkeleton, ImageUploaderSkeleton)
use: always
change: none → /order <direct parent>
rules:
using:
- base_shape: a placeholder shape → BaseSkeleton sized by className (the wrappers rule: skeleton → Skeleton/BaseSkeleton)
editing:
- build_on_base: a new skeleton in this folder is built from BaseSkeleton (one look, props stay adjustable)
read: what each skeleton is for → Overview | example → Usage | props → API
