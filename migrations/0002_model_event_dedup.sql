CREATE TABLE IF NOT EXISTS model_event_dedup (
  ip_hash TEXT NOT NULL,
  model_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('download', 'workshop')),
  counted_at INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, model_id, event_type)
);

CREATE INDEX IF NOT EXISTS model_event_dedup_counted_at_idx ON model_event_dedup(counted_at);
