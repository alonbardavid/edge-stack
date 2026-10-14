-- A nuked user is a deleted one whose personal data has been scrambled. It can
-- never be restored.
ALTER TABLE user ADD COLUMN nuked_at INTEGER;
