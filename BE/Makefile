# Go tooling for the API. golangci-lint runs from its pinned Docker image so
# everyone (and CI) uses the same version without a local install.
GOLANGCI_VERSION := v2.15.0
GOLANGCI := docker run --rm -v "$(CURDIR)":/app -w /app \
	-v restaurant-space-golangci-cache:/root/.cache \
	-v restaurant-space-gomod-cache:/go/pkg/mod \
	golangci/golangci-lint:$(GOLANGCI_VERSION) golangci-lint

.PHONY: fmt fmt-check lint lint-fix test check

fmt: ## Format code (gofmt + goimports)
	$(GOLANGCI) fmt

fmt-check: ## Fail if any file needs formatting
	$(GOLANGCI) fmt --diff

lint: ## Run linters
	$(GOLANGCI) run

lint-fix: ## Run linters and apply automatic fixes
	$(GOLANGCI) run --fix

test:
	go vet ./... && go test ./...

check: fmt-check lint test
