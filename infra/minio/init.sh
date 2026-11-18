#!/bin/sh
set -eu

# Validate before interpolating a bucket name into the JSON policy.
case "$S3_BUCKET" in
  ''|*[!a-z0-9.-]*) echo 'Invalid S3_BUCKET' >&2; exit 1 ;;
esac
attempt=0
until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then echo 'MinIO did not become ready' >&2; exit 1; fi
  sleep 2
done
mc mb --ignore-existing "local/$S3_BUCKET"
mc anonymous set none "local/$S3_BUCKET"
cat > /tmp/app-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Action":["s3:GetBucketLocation","s3:ListBucket"],"Resource":["arn:aws:s3:::$S3_BUCKET"]},
    {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::$S3_BUCKET/*"]}
  ]
}
EOF
mc admin user add local "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
mc admin policy create local restaurant-images-app /tmp/app-policy.json
mc admin policy attach local restaurant-images-app --user "$S3_ACCESS_KEY_ID"
echo 'Private image bucket and application credentials are ready.'
