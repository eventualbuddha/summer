-- Migration: 000_migrations_table
-- Description: Create the migrations tracking table
-- Date: 2026-02-15

DEFINE TABLE migration SCHEMAFULL;
DEFINE FIELD name ON TABLE migration TYPE string;
DEFINE FIELD applied_at ON TABLE migration TYPE datetime;
DEFINE INDEX migrationNameIndex ON TABLE migration COLUMNS name UNIQUE;
