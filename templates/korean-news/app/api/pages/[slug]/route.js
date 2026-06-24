import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, requireAuth } from '@/lib/auth';

// GET /api/pages/[slug] — Fetch single page
export async function GET(request, { params }) {
  try {
    const { slug } = await params;

    const isId = /^\d+$/.test(slug);
    const sql = isId
      ? 'SELECT * FROM pages WHERE id = ?'
      : 'SELECT * FROM pages WHERE slug = ?';

    const pages = await query(sql, [slug]);
    if (pages.length === 0) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json({ page: pages[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/pages/[slug] — Update page metadata and blocks layout
export async function PUT(request, { params }) {
  const user = await getAuthUser();
  const authErr = requireAuth(user, 'mod');
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  try {
    const { slug: identifier } = await params;
    const body = await request.json();
    const { title, slug: customSlug, description, meta_title, meta_description, meta_keywords, layout, status } = body;

    const isId = /^\d+$/.test(identifier);
    const selectSql = isId
      ? 'SELECT * FROM pages WHERE id = ?'
      : 'SELECT * FROM pages WHERE slug = ?';

    const pages = await query(selectSql, [identifier]);
    if (pages.length === 0) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const currentPage = pages[0];
    const pageId = currentPage.id;

    // Validate and format the new slug
    let newSlug = customSlug || title || currentPage.slug;
    newSlug = newSlug.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim().replace(/\s+/g, '-');

    if (!newSlug) {
      newSlug = currentPage.slug;
    }

    // Verify slug uniqueness if it has changed
    if (newSlug !== currentPage.slug) {
      const duplicate = await query('SELECT id FROM pages WHERE slug = ? AND id != ?', [newSlug, pageId]);
      if (duplicate.length > 0) {
        return NextResponse.json({ error: `Slug '${newSlug}' is already taken by another page` }, { status: 400 });
      }
    }

    const layoutStr = typeof layout === 'object' && layout !== null ? JSON.stringify(layout) : (layout || currentPage.layout || '[]');

    await query(
      `UPDATE pages
       SET title = ?, slug = ?, description = ?, meta_title = ?, meta_description = ?, meta_keywords = ?, layout = ?, status = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [
        title || currentPage.title,
        newSlug,
        description ?? currentPage.description,
        meta_title ?? currentPage.meta_title ?? '',
        meta_description ?? currentPage.meta_description ?? '',
        meta_keywords ?? currentPage.meta_keywords ?? '',
        layoutStr,
        status || currentPage.status,
        pageId
      ]
    );

    const updatedPage = await query('SELECT * FROM pages WHERE id = ?', [pageId]);
    return NextResponse.json({ page: updatedPage[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/pages/[slug] — Delete page
export async function DELETE(request, { params }) {
  const user = await getAuthUser();
  const authErr = requireAuth(user, 'mod');
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  try {
    const { slug } = await params;

    const isId = /^\d+$/.test(slug);
    const selectSql = isId
      ? 'SELECT id, slug FROM pages WHERE id = ?'
      : 'SELECT id, slug FROM pages WHERE slug = ?';

    const pages = await query(selectSql, [slug]);
    if (pages.length === 0) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const pageToDelete = pages[0];

    // Block deleting the home page index if created
    if (pageToDelete.slug === 'index' || pageToDelete.slug === 'home') {
      return NextResponse.json({ error: 'System index/home page cannot be deleted' }, { status: 400 });
    }

    await query('DELETE FROM pages WHERE id = ?', [pageToDelete.id]);
    return NextResponse.json({ success: true, message: 'Page deleted successfully' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
