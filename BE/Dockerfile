FROM golang:1.24-bookworm AS build
WORKDIR /src
# Dependencies come from the committed go.sum; verify catches tampered modules.
COPY go.mod go.sum ./
RUN go mod download && go mod verify
COPY . .
# The build checks formatting instead of rewriting files (run `make fmt` locally).
RUN test -z "$(gofmt -l cmd internal docs/embed.go)" || (gofmt -l cmd internal docs/embed.go && echo "run make fmt" && exit 1)
RUN go vet ./... && go test ./... && CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/api ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/api"]
