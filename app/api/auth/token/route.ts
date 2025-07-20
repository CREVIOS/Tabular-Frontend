import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ accessToken: null }, { status: 200 });
    }

    return NextResponse.json({ accessToken }, { status: 200 });
  } catch (error) {
    console.error('Failed to get access token from cookies:', error);
    return NextResponse.json({ accessToken: null }, { status: 200 });
  }
} 