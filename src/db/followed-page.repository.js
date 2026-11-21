/**
 * Followed Facebook Pages Repository: Direct PostgreSQL persistence with UUID student_id.
 */

const crypto = require('node:crypto');
const { db: defaultDb, createDbAdapter } = require('../config/db');
const { isUuid } = require('./student.repository');

function normalizeFollowedPageRow(row) {
  if (!row) return null;
  const copy = { ...row };
  if (copy.last_scraped_at instanceof Date) copy.last_scraped_at = copy.last_scraped_at.toISOString();
  if (copy.created_at instanceof Date) copy.created_at = copy.created_at.toISOString();
  if (copy.updated_at instanceof Date) copy.updated_at = copy.updated_at.toISOString();
  return copy;
}

class FollowedPageRepository {
  constructor(poolOrDb = null) {
    this.db = poolOrDb && typeof poolOrDb.query === 'function'
      ? poolOrDb
      : (poolOrDb ? createDbAdapter(poolOrDb) : defaultDb);
  }

  async saveFollowedPage(studentUuid, page, client = null) {
    if (!isUuid(studentUuid)) {
      throw new Error(`Invalid student UUID for followed_fb_pages: ${studentUuid}`);
    }
    const runner = client || this.db;
    const id = isUuid(page.id) ? page.id : crypto.randomUUID();
    const { rows } = await runner.query(
      `INSERT INTO followed_fb_pages (
         id, student_id, page_url, page_name, page_username, channel_code, is_active, created_at, updated_at
       ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, TRUE, NOW(), NOW())
       ON CONFLICT (student_id, page_url) DO UPDATE SET
         page_name = EXCLUDED.page_name,
         page_username = EXCLUDED.page_username,
         channel_code = EXCLUDED.channel_code,
         is_active = TRUE,
         updated_at = NOW()
       RETURNING *`,
      [
        id,
        studentUuid,
        page.page_url,
        page.page_name,
        page.page_username,
        page.channel_code,
      ]
    );
    return normalizeFollowedPageRow(rows[0]);
  }

  async getFollowedPages(studentUuid, client = null) {
    if (!isUuid(studentUuid)) return [];
    const runner = client || this.db;
    const { rows } = await runner.query(
      `SELECT * FROM followed_fb_pages
       WHERE student_id = $1::uuid AND is_active = TRUE
       ORDER BY created_at DESC`,
      [studentUuid]
    );
    return rows.map(normalizeFollowedPageRow);
  }

  async deleteFollowedPage(pageIdOrSlug, studentUuid = null, client = null) {
    const runner = client || this.db;
    const cleanTarget = String(pageIdOrSlug || '').trim();
    if (!cleanTarget) return false;

    if (studentUuid && isUuid(studentUuid)) {
      const { rowCount } = await runner.query(
        `UPDATE followed_fb_pages
         SET is_active = FALSE, updated_at = NOW()
         WHERE student_id = $1::uuid
           AND is_active = TRUE
           AND (id::text = $2 OR page_username = $2 OR page_url = $2)`,
        [studentUuid, cleanTarget]
      );
      return rowCount > 0;
    }

    const { rowCount } = await runner.query(
      `UPDATE followed_fb_pages
       SET is_active = FALSE, updated_at = NOW()
       WHERE is_active = TRUE
         AND (id::text = $1 OR page_username = $1 OR page_url = $1)`,
      [cleanTarget]
    );
    return rowCount > 0;
  }

  async getAllActiveFollowedPages(client = null) {
    const runner = client || this.db;
    const { rows } = await runner.query(
      `SELECT DISTINCT ON (page_url) *
       FROM followed_fb_pages
       WHERE is_active = TRUE
       ORDER BY page_url, updated_at DESC`
    );
    return rows.map(normalizeFollowedPageRow);
  }
}

const followedPageRepository = new FollowedPageRepository();

module.exports = {
  FollowedPageRepository,
  followedPageRepository,
  normalizeFollowedPageRow,
};
