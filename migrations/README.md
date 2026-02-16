# Database Migrations

This directory contains SurrealDB schema migrations for the Summer application.

## Migration Files

Migrations are numbered sequentially and applied in order:

- `000_migrations_table.surql` - Creates the migrations tracking table (applied automatically)
- `001_initial_schema.surql` - Initial database schema
- `002_tag_cleanup_event.surql` - Adds tagged relation table and auto-cleanup event

## Running Migrations

Use the `bin/migrate` script to apply pending migrations:

```bash
# Local development (defaults to localhost:8001, summer/summer)
./bin/migrate

# With custom endpoint
./bin/migrate -u http://localhost:8000

# With authentication (will prompt for password)
./bin/migrate -u http://localhost:8000 -U root

# Custom namespace/database
./bin/migrate -u http://localhost:8000 -n myns -d mydb

# Piped password for automation
echo "mypassword" | ./bin/migrate -u http://localhost:8000 -U root
```

## Creating a New Migration

1. Create a new file in `migrations/` with the next sequential number:

   ```
   migrations/003_my_new_feature.surql
   ```

2. Add migration metadata as comments at the top:

   ```sql
   -- Migration: 003_my_new_feature
   -- Description: Brief description of what this migration does
   -- Date: YYYY-MM-DD
   ```

3. Write your migration SQL:

   ```sql
   DEFINE TABLE my_table SCHEMAFULL;
   DEFINE FIELD my_field ON TABLE my_table TYPE string;
   ```

4. Test the migration:
   ```bash
   ./bin/migrate -u http://localhost:8003 -n test -d test
   ```

## Important Notes

- **Migrations are irreversible** - there is no "down" migration support
- **Backup before migrating** - use `./bin/backup` to create a backup first
- **Events must be single-line** - SurrealDB CLI breaks up multiline statements when piped
- **Test migrations first** - always test on a copy of your data before applying to production

## Migration Tracking

The `migration` table tracks which migrations have been applied:

```sql
SELECT * FROM migration ORDER BY applied_at ASC;
```

Each record contains:

- `name` - Migration filename (without .surql extension)
- `applied_at` - Timestamp when the migration was applied
