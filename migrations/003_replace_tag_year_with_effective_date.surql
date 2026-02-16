-- Migration: 003_replace_tag_year_with_effective_date
-- Description: Replace year on `tagged` relation with an effective date to
--              allow setting when a transaction is considered to have occurred.
-- Date: 2026-02-15

DEFINE FIELD effectiveDate ON transaction TYPE option<datetime>;

FOR $row IN (
    SELECT in AS transaction, year
    FROM tagged
    WHERE year IS NOT NONE
) {
    UPDATE $row.transaction
    SET effectiveDate = (
        IF $row.year == date.year() {
            NONE
        } else {
            <datetime> string::concat(
                <string> $row.year,
                "-01-01T12:00:00Z"
            )
        }
    );
};

REMOVE FIELD year ON tagged;
