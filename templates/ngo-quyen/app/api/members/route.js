import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const members = await query(
      'SELECT id, username, display_name, email, role, avatar, active, join_date, created_at FROM users ORDER BY created_at DESC'
    );
    return NextResponse.json({ members });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getAuthUser();
  const authErr = requireAuth(user, 'admin');
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  try {
    const bcrypt = (await import('bcryptjs')).default;
    const { username, password, display_name, email, role } = await request.json();
    if (!username || !password) return NextResponse.json({ error: 'Thiếu username/password' }, { status: 400 });

    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json({ error: 'Mật khẩu phải có tối thiểu 8 ký tự, chứa ít nhất 1 chữ hoa (A-Z) và 1 ký tự đặc biệt' }, { status: 400 });
    }

    const existing = await query('SELECT id FROM users WHERE username=?', [username]);
    if (existing.length) return NextResponse.json({ error: 'Username đã tồn tại' }, { status: 409 });

    const hashed = await bcrypt.hash(password, 10);
    const today = new Date().toISOString().split('T')[0];

    const result = await query(
      'INSERT INTO users (username, password, display_name, email, role, active, join_date) VALUES (?,?,?,?,?,1,?)',
      [username, hashed, display_name || username, email || '', role || 'member', today]
    );

    const newUser = await query(
      'SELECT id, username, display_name, email, role, active, join_date FROM users WHERE id=?',
      [result.insertId]
    );
    return NextResponse.json({ member: newUser[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
