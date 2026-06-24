import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, requireAuth } from '@/lib/auth';

// GET /api/pages — Retrieve dynamic pages
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let sql = 'SELECT id, slug, title, description, meta_title, meta_description, meta_keywords, status, created_at, updated_at FROM pages WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const pages = await query(sql, params);
    return NextResponse.json({ pages });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/pages — Create a new page
export async function POST(request) {
  const user = await getAuthUser();
  const authErr = requireAuth(user, 'mod'); // Mod or Admin minimum requirement
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  try {
    const body = await request.json();
    const { title, slug: customSlug, description, meta_title, meta_description, meta_keywords, layout, status } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Auto-generate or format slug
    let slug = customSlug || title;
    slug = slug.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim().replace(/\s+/g, '-');

    if (!slug) {
      slug = 'page-' + Date.now();
    }

    // Check duplicate slug
    const duplicate = await query('SELECT id FROM pages WHERE slug = ?', [slug]);
    if (duplicate.length > 0) {
      return NextResponse.json({ error: `A page with slug '${slug}' already exists` }, { status: 400 });
    }

    const layoutStr = typeof layout === 'object' && layout !== null ? JSON.stringify(layout) : (layout || '[]');

    const result = await query(
      `INSERT INTO pages (slug, title, description, meta_title, meta_description, meta_keywords, layout, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, title, description || '', meta_title || '', meta_description || '', meta_keywords || '', layoutStr, status || 'draft']
    );

    const newPage = await query('SELECT * FROM pages WHERE id = ?', [result.insertId]);
    return NextResponse.json({ page: newPage[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
