package docs

import _ "embed"

//go:embed openapi.json
var OpenAPI []byte

const HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Restaurant Space API</title></head>
<body><div id="app"></div><script type="module">
import { createApiReference } from 'https://cdn.jsdelivr.net/npm/@scalar/api-reference/esm.js';
createApiReference('#app', { url: '/openapi.json' });
</script></body></html>`
