import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
const accountCookie = await (await cookieStore).get('pi_account');
    
    if (!accountCookie) {
      return NextResponse.json({ accounts: [] });
    }
    
    // Parse the stored account data
    const accountData = JSON.parse(accountCookie.value);
    
    // Return the account information without sensitive data
    return NextResponse.json({
      accounts: [{
        phone_number: accountData.phone_number,
        user_id: accountData.user_id
      }]
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { phone_number } = data;
    
    const cookieStore = cookies();
    (await cookieStore).delete('pi_account');
    
    return NextResponse.json({
      success: true,
      message: 'Account removed successfully'
    });
  } catch (error) {
    console.error('Error removing account:', error);
    return NextResponse.json(
      { error: 'Failed to remove account' },
      { status: 500 }
    );
  }
}