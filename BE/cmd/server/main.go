package main

import (
	"log/slog"
	"os"

	"restaurant-space/api/internal/bootstrap"
)

func main() {
	if e := bootstrap.Run(); e != nil {
		slog.Error("server stopped", "error", e)
		os.Exit(1)
	}
}
