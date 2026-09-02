CREATE TABLE IF NOT EXISTS model_stats (
  model_id TEXT PRIMARY KEY,
  downloads INTEGER NOT NULL DEFAULT 0 CHECK (downloads >= 0),
  workshop_clicks INTEGER NOT NULL DEFAULT 0 CHECK (workshop_clicks >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS model_stats_updated_at_idx ON model_stats(updated_at);
