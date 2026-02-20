# Summer – Agent Guide

Summer is a personal finance application for tracking transactions, managing budgets, and generating reports. It has a SvelteKit frontend and SurrealDB backend, deployed as a Node.js server.

## Tech Stack

- **Frontend**: SvelteKit + Svelte 5 (TypeScript, Tailwind CSS 4)
- **Backend**: SvelteKit API routes + Express server (`server.js`)
- **Database**: SurrealDB v2 (graph database)
- **Testing**: Playwright (e2e), Vitest (unit)
- **Linting**: Prettier + ESLint, enforced via pre-commit hooks (husky + lint-staged)

## Project Structure

```
summer/
├── src/
│   ├── routes/               # SvelteKit routes (pages + API endpoints)
│   │   └── api/              # REST API endpoints
│   │       └── transactions/ # Transaction CRUD, bulk edit, tags, etc.
│   └── lib/
│       ├── components/       # Svelte components
│       ├── screens/          # Top-level page content components
│       ├── db/               # Database type definitions and utilities
│       ├── server/           # Server-side utilities (DB connection)
│       ├── utils/            # Shared utilities (formatting, etc.)
│       ├── api.ts            # Client-side API helpers (fetchJson, patchJson, etc.)
│       ├── state.svelte.ts   # Global reactive state (Svelte 5 class with runes)
│       └── types.ts          # Shared TypeScript types
├── e2e/                      # Playwright e2e tests
├── src/**/*.test.ts          # Vitest unit tests (co-located with source)
├── migrations/               # SurrealDB schema migrations
├── static/
├── bin/                      # CLI utilities (backup, restore, migrate)
└── server.js                 # Production Node.js entry point
```

## Running the App

```bash
# Development (starts SurrealDB + Vite dev server)
npm run dev

# Production build
npm run build

# Run production server (after building)
node server.js
# or
npm run start
```

SurrealDB listens on `http://127.0.0.1:8000` locally, namespace `summer`, database `summer`.

## Svelte 5 Runes

This project uses **Svelte 5 runes syntax** throughout. Key patterns:

```svelte
<script lang="ts">
	// Props
	let { value, onchange }: { value: string; onchange: (v: string) => void } = $props();
	let { items = $bindable() }: { items: string[] } = $props();

	// Reactive state
	let count = $state(0);

	// Derived values
	let doubled = $derived(count * 2);
	let computed = $derived.by(() => {
		return someExpensiveCalculation(count);
	});

	// Side effects
	$effect(() => {
		console.log('count changed:', count);
	});
</script>
```

Avoid the old Svelte 4 syntax (`$:`, `export let`, etc.).

## API Patterns

**API routes** (`src/routes/api/`):

- Use SvelteKit's `RequestHandler` type
- Return JSON with the `json()` helper
- Handle errors with appropriate HTTP status codes

**Client-side helpers** (`src/lib/api.ts`):

```typescript
fetchJson(url); // GET, returns parsed JSON
postJson(url, body); // POST
patchJson(url, body); // PATCH
deleteJson(url, body); // DELETE
```

All throw on non-OK responses.

**Error handling** uses `@badrap/result`:

```typescript
import { Result } from '@badrap/result';

// Returning a Result from state methods
async function doSomething(): Promise<Result<void>> {
  try {
    await patchJson('/api/...', { ... });
    return Result.ok(undefined);
  } catch (e) {
    return Result.err(e instanceof Error ? e : new Error(String(e)));
  }
}
```

**SurrealDB queries** (`src/lib/server/db.ts`):

```typescript
// Typed query (for simple queries returning arrays)
const rows = await db.query<[SomeType[]]>('SELECT * FROM table WHERE ...');

// Raw query (for multi-statement transactions, FOR loops, etc.)
const results = await db.queryRaw(
	`BEGIN TRANSACTION;
   DELETE tagged WHERE in IN $transactions;
   FOR $tx IN $transactions { ... };
   COMMIT TRANSACTION;`,
	{ transactions: recordIds }
);
```

## SurrealDB Patterns

### Edge Records (Graph Relations)

Transactions are linked to tags via edge records:

```sql
-- Create edge
RELATE transaction:id->tagged->tag:id;

-- Traverse edges
SELECT ->tagged->tag.name AS tags FROM transaction:id;

-- Delete edges for specific source records
DELETE tagged WHERE in IN $transactions;  -- NOT: DELETE $transactions->tagged
```

The `DELETE $array->relation` syntax does NOT work on arrays; use `DELETE relation WHERE in IN $array` instead.

### Multi-Statement Transactions with FOR Loops

For bulk operations, use `queryRaw` with a single string containing `BEGIN TRANSACTION ... COMMIT TRANSACTION`. Nested `FOR` loops work:

```typescript
await db.queryRaw(
	`BEGIN TRANSACTION;
   DELETE tagged WHERE in IN $transactions;
   FOR $transaction IN $transactions {
     FOR $name IN $tags {
       LET $tag = (UPSERT tag SET name = $name WHERE name = $name RETURN VALUE id)[0];
       RELATE $transaction->tagged->$tag;
     };
   };
   COMMIT TRANSACTION;`,
	{ transactions: transactionRecordIds, tags: tagNames }
);
```

### Avoid N+1 Queries

Use `LET` variables to load data once, then filter in memory:

```sql
LET $transactions = (SELECT * FROM transaction WHERE ...);
LET $aggregated = (
  SELECT * FROM budget WHERE
  (SELECT * FROM $transactions WHERE categoryId IN $parent.categoryIds)
);
```

### Direct DB Querying for Debugging

Query SurrealDB directly without restarting the app:

```bash
surreal sql --conn http://127.0.0.1:8000 --ns summer --db summer
```

This is useful for testing query syntax and troubleshooting before wiring up to the application.

```bash
# Count records
surreal sql --conn http://127.0.0.1:8000 --ns summer --db summer <<< \
  "SELECT count() FROM transaction GROUP ALL;"

# Check table indexes
surreal sql --conn http://127.0.0.1:8000 --ns summer --db summer <<< \
  "INFO FOR TABLE transaction;"
```

## Component Patterns

### Modal Portal Pattern

Modals must teleport to `document.body` to escape parent stacking contexts (especially `VList` with transforms). See `TransactionDetailModal.svelte` and `BulkEditModal.svelte` for the pattern using `onMount` + DOM manipulation.

### Optimistic Updates

State methods in `state.svelte.ts` apply changes optimistically (update reactive state immediately), then roll back on error by restoring a snapshot taken before the update.

### VList (Virtualized List)

The transaction list uses `virtua/svelte`'s `VList` for virtualized rendering. Components rendered inside `VList` are inside a transformed container, so fixed-position elements (modals, dropdowns) must be portaled to `document.body`.

## Testing

### Unit Tests

```bash
npm run test:unit
# or
TZ=UTC vitest run src
```

### E2E Tests (Playwright) — CRITICAL

**E2E tests run against a production build, NOT the dev server.**

Always rebuild before running e2e tests:

```bash
npm run build && npx playwright test
```

If you make code changes and run `npx playwright test` without rebuilding, you are testing stale code. This is a common source of confusing failures where fixes appear to have no effect.

```bash
# Run a specific test file
npx playwright test e2e/transactions.test.ts

# Run tests matching a pattern
npx playwright test --grep "bulk edit"
```

## Linting and Formatting

```bash
npm run lint    # Check (Prettier + ESLint)
npm run format  # Auto-fix formatting
```

Prettier runs automatically on staged files via husky pre-commit hooks (`lint-staged`). If a commit fails due to a pre-commit hook, fix the issue and create a **new** commit — do not amend.

TypeScript type checking:

```bash
npm run check
```

## Commit and Push Policy

**Do not commit or push changes unless explicitly asked by the user.**

Read/explore/write code freely, but treat `git commit` and `git push` as actions requiring explicit user instruction.

## PR Workflow and Commit Convention

This repo uses **Squash and Merge** for pull requests.

- After opening a PR, if CI fails or follow-up fixes are needed, push **new commits** to the branch. Do not amend or force-push.
- Branches should be created from `main`.
- Use `gh pr create` to open PRs.
- PR title should be short (under 70 characters); put details in the body.
- Use conventional commit format: `type(scope): message`
  - Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`

## Database Schema

### Core Tables

- **transaction**: Financial transactions (amount, date, description, category, account, tags)
- **statement**: Bank/credit card statement files (groups transactions)
- **account**: Bank/credit card accounts
- **category**: Transaction categories (e.g., Food, Utilities)
- **tag**: Tags for organizing/annotating transactions
- **budget**: Budget definitions with categories and amounts

### Graph Edges

- `transaction->tagged->tag`: Tags applied to a transaction

### Important Indexes

```sql
-- Transaction indexes (critical for performance)
DEFINE INDEX transactionStatementDateIndex ON transaction COLUMNS statement.date;
DEFINE INDEX transactionStatementDateCategoryIndex ON transaction COLUMNS statement.date, category;
DEFINE INDEX transactionCategoryIndex ON transaction COLUMNS category;
DEFINE INDEX transactionDateCategoryIndex ON transaction COLUMNS date, category;
```

The composite index `(statement.date, category)` is crucial for budget report queries. When adding new query patterns that filter on multiple columns, check whether a composite index is needed.

### Schema Migrations

Migrations live in `migrations/`. Applied automatically on first start if DB is empty. To apply manually:

```bash
./bin/migrate -u http://localhost:8001 -n summer -d summer
```

## Docker Setup (Alternative)

The app can also run via Docker Compose:

```bash
docker compose up -d               # Start services
docker compose build summer        # Rebuild app after code changes
docker compose restart summer      # Restart app (does NOT rebuild!)
docker compose up -d summer        # Recreate and start app (after rebuilding)
```

**Important**: `docker compose restart` does NOT pick up code changes. You must `build` then `up -d`.

- **App**: http://localhost:3000
- **SurrealDB (external)**: http://localhost:8001
- **Database data**: Persisted in `/home/brian/summer-data` on host

## Backup & Restore

The app includes management utilities for backing up and restoring the SurrealDB database. This can be useful for backups of production databases, testing local changes using a copy of the production database, etc.

```bash
# Backup
./bin/backup -o backups/ -u http://localhost:8000 -n summer -d summer

# Restore
./bin/restore -i 'backups/<YYYY-MM-DDTHH:MM:SS.MMMZ>/' -u http://localhost:8000 -n summer -d summer
```

## Performance Considerations

### General Tips

1. **Always check indexes** when queries are slow: `INFO FOR TABLE <table>;`
2. **Profile queries directly in SurrealDB** to isolate bottlenecks before changing application code
3. **Use composite indexes** for multi-column filters
4. **Avoid correlated subqueries** — load data once with `LET`, then filter in-memory
5. **Test with realistic data volumes** — empty databases won't reveal performance issues

### Case Study: Budget Reports (~279x Speedup)

- **Symptom**: `/api/reports/budgets` was taking ~6.7 seconds
- **Root cause**: Correlated subqueries causing N+1 pattern (8 budgets × 3 queries = 24 full table scans), plus missing indexes
- **Fix**: Added `(statement.date, category)` composite index + used `LET` to load transactions once
- **Result**: 6.7s → 0.024s

## Troubleshooting

### "Internal Error" from API

- Check server logs (when running locally, they appear in the terminal running `node server.js` or `npm run dev`)
- Look for database connection issues or query syntax errors in the logs

### Empty Results from Queries

- Verify the database has data by querying directly with the SurrealDB CLI
- Confirm correct namespace (`summer`) and database (`summer`) are in use

### Slow Queries

- Check if indexes exist: `INFO FOR TABLE <table>;`
- Test query directly in SurrealDB CLI to isolate whether the problem is in the query or the app
- Look for N+1 patterns or missing composite indexes

### E2E Tests Failing Despite Code Fixes

- Most likely cause: forgot to rebuild. Run `npm run build` before `npx playwright test`.

## Additional Resources

- [SurrealDB Docs](https://surrealdb.com/docs)
- [SvelteKit Docs](https://kit.svelte.dev/docs)
