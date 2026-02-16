-- Migration: 002_tag_cleanup_event
-- Description: Add tagged relation table and auto-cleanup event for unused tags
-- Date: 2026-02-15

DEFINE EVENT cleanup_unused_tags ON TABLE tagged WHEN $event = "DELETE" THEN {
    LET $tag_id = $before.out;
    LET $remaining = (SELECT count() FROM tagged WHERE out = $tag_id GROUP ALL)[0].count ?? 0;
    IF $remaining == 0 {
        DELETE $tag_id;
    };
};
