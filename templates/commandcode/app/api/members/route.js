import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, requireAuth, hashPassword } from '@/lib/auth';

// GET /api/members — List all users (admin only)
export async function GET() {
  const user = await getAuthUser();
  const authErr = requireAuth(user, 'admin');
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  try {
    const members = await query(
      'SELECT id, username, display_name, email, role, tier, active, created_at FROM users ORDER BY created_at DESC'
    );
    return NextResponse.json({ members });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/members — Admin create a member (admin only)
export async function POST(request) {
  const user = await getAuthUser();
  const authErr = requireAuth(user, 'admin');
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  try {
    const { username, password, display_name, email, role, tier } = await request.json();
    if (!username || !password || !email) {
      return NextResponse.json({ error: 'Username, password, and email are required.' }, { status: 400 });
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long, contain at least 1 uppercase letter, and at least 1 special character.' }, { status: 400 });
    }

    const existing = await query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    const hashed = await hashPassword(password);
    const chosenRole = ['member', 'mod', 'admin'].includes(role) ? role : 'member';
    const chosenTier = ['Free', 'Pro', 'Enterprise'].includes(tier) ? tier : 'Free';

    const result = await query(
      'INSERT INTO users (username, password, display_name, email, role, tier, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [username, hashed, display_name || username, email, chosenRole, chosenTier]
    );

    const newUser = await query(
      'SELECT id, username, display_name, email, role, tier, active, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    return NextResponse.json({ member: newUser[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
