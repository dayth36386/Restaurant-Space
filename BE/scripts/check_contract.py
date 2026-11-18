"""Static route/reference consistency checks; does not replace Go or runtime tests."""
import json
import re
from pathlib import Path

BE_ROOT = Path(__file__).resolve().parents[1]

spec = json.loads((BE_ROOT / 'docs/openapi.json').read_text())
assert spec['openapi'] == '3.1.0'

def visit(node):
    if isinstance(node, dict):
        if '$ref' in node:
            parts = node['$ref'].removeprefix('#/').split('/')
            value = spec
            for part in parts: value = value[part]
        for value in node.values(): visit(value)
    elif isinstance(node, list):
        for value in node: visit(value)
visit(spec)
source = (BE_ROOT / 'internal/adapter/http/server.go').read_text()
actual = set()
for group, method, path in re.findall(r'\b(r|a|auth)\.(GET|POST|PATCH|DELETE)\("([^"]+)"', source):
    if path in ('/docs', '/openapi.json'): continue
    path = {'r':'', 'a':'/api/v1', 'auth':'/api/v1/auth'}[group] + path
    actual.add((method.lower(), re.sub(r':(\w+)', r'{\1}', path)))
documented = {(method, path) for path, methods in spec['paths'].items() for method in methods}
assert actual == documented, (actual-documented, documented-actual)
operation_ids = [operation['operationId'] for methods in spec['paths'].values() for operation in methods.values()]
assert len(operation_ids) == len(set(operation_ids))
print(f'PASS: {len(actual)} routes match OpenAPI; local references and operation IDs valid')
