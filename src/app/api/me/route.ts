import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'No authorization token' }, { status: 401 });
  }

  try {
    const response = await fetch('https://socialchain.app/api/me', {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
  }
}