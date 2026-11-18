package architecture

import (
	"go/parser"
	"go/token"
	"io/fs"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
)

// Guard dependency direction so a later feature cannot put Gin/GORM back in core.
func TestDependencyDirection(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	root := filepath.Join(filepath.Dir(file), "..", "..", "internal")
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		layer := strings.Split(filepath.ToSlash(rel), "/")[0]
		node, e := parser.ParseFile(token.NewFileSet(), path, nil, parser.ImportsOnly)
		if e != nil {
			return e
		}
		for _, spec := range node.Imports {
			imp, _ := strconv.Unquote(spec.Path.Value)
			if layer == "domain" || layer == "port" || layer == "usecase" {
				allowed := !strings.Contains(strings.Split(imp, "/")[0], ".")
				if layer == "port" && imp == "restaurant-space/api/internal/domain" {
					allowed = true
				}
				if layer == "usecase" && (imp == "restaurant-space/api/internal/domain" || imp == "restaurant-space/api/internal/port") {
					allowed = true
				}
				if !allowed {
					t.Errorf("%s imports forbidden dependency %s", rel, imp)
				}
			}
			if strings.HasPrefix(filepath.ToSlash(rel), "adapter/http/") && (strings.Contains(imp, "gorm.io") || strings.Contains(imp, "/adapter/mysql") || strings.Contains(imp, "/adapter/storage")) {
				t.Errorf("HTTP bypasses use cases: %s -> %s", rel, imp)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
