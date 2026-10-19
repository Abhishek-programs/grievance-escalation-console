-- Store append-only evidence for every business change.
CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  before_values JSONB,
  after_values JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX audit_entity_time_idx
  ON audit_events(entity_type,entity_id,event_time,id);

-- Track explicit mapping confirmations during review.
ALTER TABLE import_rows
  ADD COLUMN mapping_confidence TEXT NOT NULL DEFAULT 'KNOWN',
  ADD COLUMN confirmed_by TEXT,
  ADD COLUMN confirmed_at TIMESTAMPTZ;