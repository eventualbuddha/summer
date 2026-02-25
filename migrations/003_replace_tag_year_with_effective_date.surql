-- Migration: 003_replace_tag_year_with_effective_date
-- Description: Replace year on `tagged` relation with an effective date to
--              allow setting when a transaction is considered to have occurred.
-- Date: 2026-02-15

DEFINE FIELD IF NOT EXISTS effectiveDate ON transaction TYPE option<datetime>;

-- Migrate existing data: for tagged records with a year override, set the
-- transaction's effectiveDate to Jan 1 of that year (unless year matches the
-- transaction's natural year, in which case no override is needed).
-- NOTE: Guarded by IF to avoid SurrealDB v3 error from FOR over empty array.
LET $rows = (SELECT in AS transaction, year FROM tagged WHERE year IS NOT NONE);
IF array::len($rows) > 0 {
	FOR $row IN $rows {
		UPDATE $row.transaction
		SET effectiveDate = <datetime> string::concat(<string> $row.year, "-01-01T12:00:00Z")
		WHERE date.year() != $row.year;
	};
};

REMOVE FIELD IF EXISTS year ON tagged;
