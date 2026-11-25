-- 005_audio_projects.sql
-- Music Composer project registry
-- Project data (BPM, bars, tracks, notes) stored as a JSON blob in the DB.
-- No binary files — pure JSON storage.

CREATE TABLE IF NOT EXISTS audio_projects (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    bpm          INTEGER NOT NULL DEFAULT 120,
    bars         INTEGER NOT NULL DEFAULT 2,
    track_count  INTEGER NOT NULL DEFAULT 0,
    track_names  TEXT,                -- JSON array of track name strings
    tags         TEXT,                -- comma-separated
    project_data TEXT NOT NULL,       -- full project JSON blob
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audio_projects_created ON audio_projects(created_at DESC);
