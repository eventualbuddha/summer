-- Migration: 004_fix_category_ordinal_default
-- Description: Fix category ordinal DEFAULT expression for SurrealDB v3 compatibility.
--              In v3, [].max() returns [] instead of NONE, breaking the expression.
--              Redefine using array::max() which correctly returns NONE for empty arrays.
-- Date: 2026-02-24

DEFINE FIELD OVERWRITE ordinal ON TABLE category TYPE number DEFAULT (array::max((SELECT VALUE ordinal FROM category)) ?? 0) + 1;
