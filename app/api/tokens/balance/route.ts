import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get access token from cookies
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;
    
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        message: 'No access token found'
      }, { status: 401 });
    }

    // Get user context from the header set by middleware
    const userContextHeader = request.headers.get('x-user-context');
    let userId = null;
    
    if (userContextHeader) {
      try {
        const user = JSON.parse(userContextHeader);
        userId = user?.id || user?.user_id || user?.userId;
      } catch (parseError) {
        console.error('Failed to parse user context:', parseError);
      }
    }

    // Make request to Makebell Legal Agent API
    const response = await fetch(`https://makebell-supabase.onrender.com/api/tokens/balance?access_token=${accessToken}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[Balance] API request failed: ${response.status} ${response.statusText}`);
      return NextResponse.json({
        success: false,
        message: `Failed to fetch balance: ${response.statusText}`
      }, { status: response.status });
    }

    const data = await response.json();
    
    // Return the balance data
    return NextResponse.json({
      success: true,
      user_id: data.user_id || userId,
      token_balance: data.token_balance,
      last_updated: data.last_updated
    }, { status: 200 });

  } catch (error) {
    console.error('[Balance] API error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Failed to fetch balance'
    }, { status: 500 });
  }
} 