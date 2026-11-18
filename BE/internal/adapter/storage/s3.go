package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"restaurant-space/api/internal/port"
)

type S3 struct {
	client, public *minio.Client
	bucket         string
}

func New(endpoint, public, region, bucket, key, secret string) (*S3, error) {
	makeClient := func(raw string) (*minio.Client, error) {
		u, e := url.Parse(raw)
		if e != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || (u.Path != "" && u.Path != "/") {
			return nil, fmt.Errorf("invalid S3 endpoint")
		}
		return minio.New(u.Host, &minio.Options{Creds: credentials.NewStaticV4(key, secret, ""), Secure: u.Scheme == "https", Region: region, BucketLookup: minio.BucketLookupPath})
	}
	c, e := makeClient(endpoint)
	if e != nil {
		return nil, e
	}
	p, e := makeClient(public)
	if e != nil {
		return nil, e
	}
	return &S3{c, p, bucket}, nil
}
func (s *S3) Put(ctx context.Context, key string, r io.Reader, n int64, mime string) error {
	_, e := s.client.PutObject(ctx, s.bucket, key, r, n, minio.PutObjectOptions{ContentType: mime})
	return e
}
func (s *S3) URL(ctx context.Context, key string) (string, error) {
	u, e := s.public.PresignedGetObject(ctx, s.bucket, key, 5*time.Minute, url.Values{})
	if e != nil {
		return "", e
	}
	return u.String(), nil
}
func (s *S3) Delete(ctx context.Context, key string) error {
	return s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{})
}
func (s *S3) Ready(ctx context.Context) error {
	ok, e := s.client.BucketExists(ctx, s.bucket)
	if e != nil {
		return e
	}
	if !ok {
		return fmt.Errorf("bucket missing")
	}
	return nil
}

var _ port.Storage = (*S3)(nil)
