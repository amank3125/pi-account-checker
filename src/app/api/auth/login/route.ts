import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { phone_number, password } = data;
    
    // Format and normalize the phone number
    let phoneNumber = phone_number.trim();
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+91' + phoneNumber;
    }
    
    // Prepare the request body
    const requestBody = {
      phone_number: phoneNumber,
      password: password,
      continue_in_webview_ui_supported: true
    };
    
    // Call the Pi password sign-in API
    const response = await fetch('https://socialchain.app/api/password_sign_in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://socialchain.app',
        'Referer': 'https://socialchain.app/'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      console.error('Login API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Login API error response:', errorText);
      
      return NextResponse.json(
        { error: `Login failed with status ${response.status}` },
        { status: response.status }
      );
    }
    
    const responseData = await response.json();
    
    // Set cookies with account information
    const cookieStore = cookies();
    const accountData = {
      phone_number: phoneNumber,
      credentials: responseData.credentials
    };
    
    // Store account data in an encrypted cookie
    (await
          // Store account data in an encrypted cookie
          cookieStore).set('pi_account', JSON.stringify(accountData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: responseData.credentials.expires_in
    });
    
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        phone_number: phoneNumber
      },
      credentials: responseData.credentials
    });
  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
