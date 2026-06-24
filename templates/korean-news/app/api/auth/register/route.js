import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, signToken, createAuthCookie } from '@/lib/auth';

// POST /api/auth/register — Register new account
export async function POST(request) {
  try {
    const { username, password, displayName, email, tier } = await request.json();

    if (!username || !password || !email) {
      return NextResponse.json({ error: 'Username, password, and email are required.' }, { status: 400 });
    }

    if (username.length < 3 || username.includes(' ')) {
      return NextResponse.json({ error: 'Username must be at least 3 characters and contain no spaces.' }, { status: 400 });
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long, contain at least 1 uppercase letter, and at least 1 special character.' }, { status: 400 });
    }

    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Username is already taken.' }, { status: 409 });
    }

    const hashed = await hashPassword(password);
    const chosenTier = ['Free', 'Pro', 'Enterprise'].includes(tier) ? tier : 'Free';
    
    // Default role is 'member' for public registrants
    const result = await query(
      'INSERT INTO users (username, password, display_name, email, role, tier, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [username, hashed, displayName || username, email, 'member', chosenTier]
    );

    const payload = {
      id: result.insertId,
      username,
      displayName: displayName || username,
      email,
      role: 'member',
      tier: chosenTier,
    };

    const token = await signToken(payload);
    const response = NextResponse.json({ success: true, user: payload }, { status: 201 });
    const cookie = createAuthCookie(token);
    response.cookies.set(cookie);
    return response;
  } catch (err) {
    console.error('Registration error:', err);
    return NextResponse.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
