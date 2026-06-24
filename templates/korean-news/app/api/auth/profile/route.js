import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, verifyPassword, hashPassword } from '@/lib/auth';

export async function PUT(request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { displayName, email, currentPassword, newPassword } = await request.json();

    const users = await query('SELECT * FROM users WHERE id = ?', [user.id]);
    if (users.length === 0) {
      return NextResponse.json({ error: 'User does not exist' }, { status: 404 });
    }
    const dbUser = users[0];

    const fields = [];
    const vals = [];

    if (displayName !== undefined) {
      fields.push('display_name = ?');
      vals.push(displayName);
    }
    if (email !== undefined) {
      fields.push('email = ?');
      vals.push(email);
    }

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Please enter your current password to set a new password.' }, { status: 400 });
      }

      const valid = await verifyPassword(currentPassword, dbUser.password);
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
      }

      // Enforce secure password complexity
      const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]).{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        return NextResponse.json({ error: 'New password must be at least 8 characters long, contain at least 1 uppercase letter, and at least 1 special character.' }, { status: 400 });
      }

      const hashed = await hashPassword(newPassword);
      fields.push('password = ?');
      vals.push(hashed);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    vals.push(user.id);
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);

    // Fetch updated user
    const updatedUsers = await query('SELECT id, username, display_name, email, role, tier FROM users WHERE id = ?', [user.id]);
    const updatedUser = updatedUsers[0];

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        displayName: updatedUser.display_name,
        email: updatedUser.email,
        role: updatedUser.role,
        tier: updatedUser.tier
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
