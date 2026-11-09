import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluar } from "./reglas-bash.mjs";

const bloqueados = [
  "cat .env",
  "cat .env.local",
  "head .env.local",
  "tail -n 3 ./apps/api/.env.local",
  "grep . .env.local",
  "sed -n 1p .env.production",
  "awk 1 .env.local",
  "bat .env.local",
  "less .env",
  "cp .env.local /tmp/x",
  "cat < .env.local",
  "cat .env | head",
  'psql sigiso -c "DELETE FROM empresa"',
  'psql -c "update usuario set rol=1"',
  'psql -c "ALTER TABLE x DISABLE ROW LEVEL SECURITY"',
  'psql -c "ALTER ROLE sigiso_app SUPERUSER"',
  'psql -c "GRANT ALL ON x TO y"',
  'psql -c "REVOKE ALL ON x FROM y"',
  'psql -c "CREATE ROLE otro"',
  'psql -c "DROP TABLE x"',
  'psql -c "TRUNCATE x"',
  "git checkout .",
  "git checkout -- .",
  "git restore .",
  "git restore src/a.ts",
  "git restore --worktree --staged .",
  "git reset --hard",
  "git push --force",
  "git push origin main",
  ["rm", "-rf", "node_modules"].join(" "),
  // secretos en .local/
  "cat .local/secretos-keycloak.json",
  "head -c 100 ./.local/secretos-keycloak.json",
  "grep . .local/secretos-keycloak.json",
  "cat .local/realm/sigiso-realm.json",
  "cp .local/realm/x.json /tmp/x",
  "cat < .local/secretos-keycloak.json",
];
const permitidos = [
  "cat .env.example",
  "head .env.example",
  "cat README.md",
  "grep -r env docs",
  "ls -la",
  'psql sigiso -c "SELECT 1"',
  'psql sigiso_test -c "DELETE FROM empresa"',
  "pg_isready",
  "git checkout feature/x",
  "git checkout -b feature/y",
  "git restore --staged src/a.ts",
  "pnpm test",
  "node scripts/nx.mjs run-many -t test",
  "git push origin feature/x",
  "git diff",
  'grep -rn "environment" src',
  "cat src/environment.ts",
  // .local/ salvo sus secretos
  "tail -n 20 .local/keycloak.log",
  "cat .local/dev-all.log",
  "ls .local",
  "ls .local/realm",
  "grep ERROR .local/web-dev.log",
];

for (const c of bloqueados)
  test(`bloquea: ${c}`, () => assert.notEqual(evaluar(c), null));
for (const c of permitidos)
  test(`permite: ${c}`, () => assert.equal(evaluar(c), null));
