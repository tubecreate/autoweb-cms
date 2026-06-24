import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, requireAuth } from '@/lib/auth';

export async function PUT(request, { params }) {
  const user = await getAuthUser();
  const authErr = requireAuth(user, 'admin');
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  try {
    const { id } = await params;
    const body = await request.json();
    const fields = [];
    const vals = [];

    if (body.display_name !== undefined) { fields.push('display_name=?'); vals.push(body.display_name); }
    if (body.email !== undefined) { fields.push('email=?'); vals.push(body.email); }
    if (body.role !== undefined) {
      if (!['admin', 'mod', 'member'].includes(body.role)) {
        return NextResponse.json({ error: 'Role không hợp lệ' }, { status: 400 });
      }
      fields.push('role=?'); vals.push(body.role);
    }
    if (body.active !== undefined) { fields.push('active=?'); vals.push(body.active ? 1 : 0); }
    if (body.password) {
      const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
      if (!passwordRegex.test(body.password)) {
        return NextResponse.json({ error: 'Mật khẩu phải có tối thiểu 8 ký tự, chứa ít nhất 1 chữ hoa (A-Z) và 1 ký tự đặc biệt' }, { status: 400 });
      }
      const bcrypt = (await import('bcryptjs')).default;
      const hashed = await bcrypt.hash(body.password, 10);
      fields.push('password=?'); vals.push(hashed);
    }

    if (!fields.length) return NextResponse.json({ error: 'Không có dữ liệu' }, { status: 400 });
    vals.push(id);
    await query(`UPDATE users SET ${fields.join(',')} WHERE id=?`, vals);

    const updated = await query(
      'SELECT id, username, display_name, email, role, active, join_date FROM users WHERE id=?', [id]
    );
    return NextResponse.json({ member: updated[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const user = await getAuthUser();
  const authErr = requireAuth(user, 'admin');
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  try {
    const { id } = await params;
    if (Number(id) === user.id) return NextResponse.json({ error: 'Không thể xóa chính mình' }, { status: 400 });
    await query('DELETE FROM users WHERE id=?', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
