export async function addModelStats(manifest, db) {
  const stats = await readStatsSafely(db);
  return {
    ...manifest,
    models: manifest.models.map(model => ({
      ...model,
      downloadCount: stats.get(model.id)?.downloads || 0,
      workshopClickCount: stats.get(model.id)?.workshopClicks || 0,
    })),
  };
}

export async function recordModelEventSafely(db, modelId, eventType) {
  if (!db?.prepare) return;
  try {
    const sql = eventType === 'workshop'
      ? `INSERT INTO model_stats (model_id, workshop_clicks) VALUES (?, 1)
          ON CONFLICT(model_id) DO UPDATE SET workshop_clicks = workshop_clicks + 1, updated_at = datetime('now')`
      : `INSERT INTO model_stats (model_id, downloads) VALUES (?, 1)
          ON CONFLICT(model_id) DO UPDATE SET downloads = downloads + 1, updated_at = datetime('now')`;
    await db.prepare(sql).bind(modelId).run();
  } catch (error) {
    console.error('Unable to record model event', error);
  }
}

async function readStatsSafely(db) {
  const stats = new Map();
  if (!db?.prepare) return stats;
  try {
    const result = await db.prepare('SELECT model_id, downloads, workshop_clicks FROM model_stats').all();
    for (const row of result.results || []) {
      stats.set(row.model_id, {
        downloads: Number(row.downloads) || 0,
        workshopClicks: Number(row.workshop_clicks) || 0,
      });
    }
  } catch (error) {
    console.error('Unable to read model stats', error);
  }
  return stats;
}
