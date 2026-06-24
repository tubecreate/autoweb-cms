import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, verifyPassword } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function PUT(request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  try {
    const { displayName, email, currentPassword, newPassword } = await request.json();

    const users = await query('SELECT * FROM users WHERE id = ?', [user.id]);
    if (users.length === 0) {
      return NextResponse.json({ error: 'Người dùng không tồn tại' }, { status: 404 });
    }
    const dbUser = users[0];

    const fields = [];
    const vals = [];

    if (displayName !== undefined) {
      fields.push('display_name=?');
      vals.push(displayName);
    }
    if (email !== undefined) {
      fields.push('email=?');
      vals.push(email);
    }

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu' }, { status: 400 });
      }

      const valid = await verifyPassword(currentPassword, dbUser.password);
      if (!valid) {
        return NextResponse.json({ error: 'Mật khẩu hiện tại không chính xác' }, { status: 400 });
      }

      const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        return NextResponse.json({ error: 'Mật khẩu mới phải có tối thiểu 8 ký tự, chứa ít nhất 1 chữ hoa (A-Z) và 1 ký tự đặc biệt' }, { status: 400 });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      fields.push('password=?');
      vals.push(hashed);
    }

    if (!fields.length) {
      return NextResponse.json({ error: 'Không có thông tin thay đổi' }, { status: 400 });
    }

    vals.push(user.id);
    await query(`UPDATE users SET ${fields.join(',')} WHERE id=?`, vals);

    // Fetch updated user to return
    const updatedUsers = await query('SELECT id, username, display_name, email, role FROM users WHERE id=?', [user.id]);
    const updatedUser = updatedUsers[0];

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        displayName: updatedUser.display_name,
        email: updatedUser.email,
        role: updatedUser.role
      }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
