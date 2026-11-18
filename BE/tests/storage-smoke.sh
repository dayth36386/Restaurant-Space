#!/bin/sh
set -eu
mc alias set app http://minio:9000 "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
object="app/$S3_BUCKET/smoke/$(date +%s)-$$.txt"
trap 'mc rm "$object" >/dev/null 2>&1 || true' EXIT
printf 'restaurant-storage-smoke' > /tmp/smoke.txt
mc cp /tmp/smoke.txt "$object"
test "$(mc cat "$object")" = 'restaurant-storage-smoke'
mc rm "$object"
if mc stat "$object" >/dev/null 2>&1; then
  echo 'Object still exists after deletion' >&2
  exit 1
fi
echo 'S3 put/get/delete passed using application credentials.'
