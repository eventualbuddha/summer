# Summer - Repository Guide for AI Agents

This document provides context about the Summer application for AI assistants working on this codebase.

## Overview

Summer is a personal finance/budgeting application for tracking transactions, managing budgets, and generating reports. It's a web application with a SvelteKit frontend and SurrealDB backend.

## Tech Stack

- **Frontend**: SvelteKit (TypeScript)
- **Backend**: Node.js with SvelteKit API routes
- **Database**: SurrealDB
- **Deployment**: Docker (docker-compose)
- **Testing**: Playwright (e2e), Vitest (unit)

## Project Structure

```
summer/
├── src/
│   ├── routes/           # SvelteKit routes (pages + API endpoints)
│   │   ├── api/          # API endpoints
│   │   │   ├── budgets/
│   │   │   ├── transactions/
│   │   │   ├── reports/
│   │   │   └── ...
│   │   └── ...           # Frontend pages
│   └── lib/
│       ├── db/           # Database schemas and utilities
│       ├── server/       # Server-side utilities
│       └── components/   # Svelte components
├── static/
│   └── schema.surql      # SurrealDB schema definition
├── bin/                  # CLI utilities (backup, restore, etc.)
├── backups/              # Database backups
└── tests/                # Test files
```

## Database (SurrealDB)

### Connection Details (Docker)

- **Host**: `localhost:8001` (external), `surrealdb:8000` (internal)
- **Namespace**: `summer`
- **Database**: `summer`
- **Authentication**: Unauthenticated mode

### Core Tables

- **transaction**: Financial transactions with statement, category, amount, date
- **statement**: Bank/credit card statements (groups transactions)
- **budget**: Budget definitions with categories and amounts
- **category**: Transaction categories (e.g., Food, Utilities)
- **account**: Bank/credit card accounts
- **tag**: Tags for organizing transactions
- **file**: Uploaded statement files (binary data)

### Important Indexes

```sql
-- Transaction indexes (critical for performance)
DEFINE INDEX transactionStatementDateIndex ON transaction COLUMNS statement.date;
DEFINE INDEX transactionStatementDateCategoryIndex ON transaction COLUMNS statement.date, category;
DEFINE INDEX transactionCategoryIndex ON transaction COLUMNS category;
DEFINE INDEX transactionDateCategoryIndex ON transaction COLUMNS date, category;
```

**Performance Note**: The composite index `(statement.date, category)` is crucial for budget report queries.

### Schema Management

- Schema is defined in `static/schema.surql`
- **WARNING**: The schema file starts with `REMOVE TABLE IF EXISTS` commands - applying it will delete all data
- Always backup before applying schema changes
- Use `./bin/backup` and `./bin/restore` for data management

## Key Patterns & Conventions

### Database Queries

1. **Avoid N+1 Queries**: Use `let` variables to load data once, then filter in memory

   ```sql
   let $transactions = (SELECT ... FROM transaction WHERE ...);
   let $aggregated = (
     SELECT ... FROM budget WHERE ...
     (SELECT ... FROM $transactions WHERE categoryId IN $parent.categoryIds)
   );
   ```

2. **Index Usage**: When filtering on multiple fields, ensure composite indexes exist
   - Use date ranges for index-friendly queries when possible
   - `.year()` functions work but may not always use indexes optimally

3. **Prefer Database Aggregation**: Keep aggregation logic in the database rather than in TypeScript

### API Routes

- Located in `src/routes/api/`
- Use SvelteKit's `RequestHandler` type
- Return JSON with `json()` helper
- Handle errors with proper HTTP status codes

### Backup & Restore

```bash
# Backup
./bin/backup -o backups/ -u http://localhost:8001 -n summer -d summer

# Restore
./bin/restore -i backups/YYYY-MM-DDTHH:MM:SS.MMMZ/ -u http://localhost:8001 -n summer -d summer
```

**Important**: When restoring, use `-u http://localhost:8001` (not 8000) since that's the external port.

## Docker Setup

### Starting the Application

```bash
docker compose up -d               # Start services
docker compose build summer        # Rebuild app after code changes
docker compose restart summer      # Restart app (doesn't rebuild!)
docker compose up -d summer        # Recreate and start app
```

### Important Notes

- **Code changes require rebuild**: `docker compose restart` does NOT pick up code changes
- **Schema changes**: Apply with `cat static/schema.surql | docker exec -i summer-surrealdb /surreal sql --endpoint http://localhost:8000 --namespace summer --database summer`
- **Database data**: Persisted in `/home/brian/summer-data` on host

### Accessing Services

- **App**: http://localhost:3000
- **SurrealDB**: http://localhost:8001

## Common Tasks

### Adding a Database Index

1. Update `static/schema.surql`
2. Apply to database:
   ```bash
   cat static/schema.surql | docker exec -i summer-surrealdb /surreal sql --endpoint http://localhost:8000 --namespace summer --database summer
   ```
3. **WARNING**: This will reset all tables - restore data afterward

### Testing Query Performance

Test directly in SurrealDB to isolate database performance from network/app overhead:

```bash
echo "SELECT ... FROM transaction WHERE ...;" | docker exec -i summer-surrealdb /surreal sql --endpoint http://localhost:8000 --namespace summer --database summer
```

### Checking Database Contents

```bash
# Count records
echo "SELECT count() FROM transaction GROUP ALL;" | docker exec -i summer-surrealdb /surreal sql --endpoint http://localhost:8000 --namespace summer --database summer

# Check indexes
echo "INFO FOR TABLE transaction;" | docker exec -i summer-surrealdb /surreal sql --endpoint http://localhost:8000 --namespace summer --database summer
```

## Performance Considerations

### Budget Reports Optimization (Case Study)

**Problem**: `/api/reports/budgets` endpoint was taking ~6.7 seconds

**Root Cause**:

- Correlated subqueries causing N+1 query pattern
- 8 budgets × 3 queries each = 24 full table scans
- Missing indexes on frequently filtered columns

**Solution**:

1. Added index on `transaction.statement.date`
2. Added composite index on `(statement.date, category)`
3. Used `let` variables to load transactions once
4. Filter and aggregate in-memory for each budget

**Result**: ~6.7s → ~0.024s (~279x faster with composite index)

### General Performance Tips

1. **Always check indexes** when queries are slow
2. **Profile queries directly in SurrealDB** to isolate bottlenecks
3. **Use composite indexes** for multi-column filters
4. **Avoid correlated subqueries** - load once, filter in memory
5. **Test with realistic data volumes** - empty databases won't show performance issues

## Git Workflow

- Use conventional commit format: `type(scope): message`
  - Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`
- Create feature branches
- Use `gh pr create` for pull requests
- Pre-commit hooks run prettier and linting

## Testing

```bash
npm run test:unit
npm run test:e2e
npm run lint
```

## Troubleshooting

### "Internal Error" from API

- Check Docker logs: `docker logs summer-app --tail 50`
- Look for database connection issues or query syntax errors

### Empty Results from Queries

- Verify database has data: Check with SurrealDB CLI
- Confirm correct namespace/database in use
- Check if schema was accidentally reset

### Slow Queries

- Check if indexes exist: `INFO FOR TABLE <table>;`
- Test query directly in SurrealDB to isolate performance
- Look for N+1 patterns or missing composite indexes

## Additional Resources

- [SurrealDB Docs](https://surrealdb.com/docs)
- [SvelteKit Docs](https://kit.svelte.dev/docs)
