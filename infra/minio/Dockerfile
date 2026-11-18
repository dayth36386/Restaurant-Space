FROM golang:1.24-bookworm AS minio-build
WORKDIR /src
# Build upstream source, avoiding unavailable MinIO container registries.
RUN git clone --depth 1 --branch RELEASE.2025-04-22T22-12-26Z https://github.com/minio/minio.git .
RUN CGO_ENABLED=0 go build -mod=readonly -p 2 -trimpath -o /out/minio .

FROM golang:1.24-bookworm AS mc-build
WORKDIR /src
RUN git clone --depth 1 --branch RELEASE.2025-04-16T18-13-26Z https://github.com/minio/mc.git .
RUN CGO_ENABLED=0 go build -mod=readonly -p 2 -trimpath -o /out/mc .

FROM debian:bookworm-slim AS minio
COPY --from=minio-build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=minio-build /out/minio /usr/local/bin/minio
COPY --from=minio-build /src/LICENSE /licenses/LICENSE
RUN mkdir -p /data
EXPOSE 9000 9001
ENTRYPOINT ["/usr/local/bin/minio"]
CMD ["server", "/data", "--console-address", ":9001"]

# Keep a shell/coreutils for the existing init and storage smoke-test scripts.
FROM debian:bookworm-slim AS mc
COPY --from=mc-build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=mc-build /out/mc /usr/local/bin/mc
COPY --from=mc-build /src/LICENSE /licenses/LICENSE
ENTRYPOINT ["/usr/local/bin/mc"]
