import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Format the phone number with +91 prefix if needed
    let phoneNumber = data.phoneNumber;
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+91' + phoneNumber;
    }
    
    // For testing purposes - return mock data to ensure correct detection
    // Change to if(false) when ready to use the real API
    if (false) {
      // For testing: Return "account found" for some numbers and "not found" for others
      // Using the last digit to determine the response (even = found, odd = not found)
      const lastDigit = parseInt(phoneNumber.charAt(phoneNumber.length - 1));
      const isAccountFound = lastDigit % 2 === 0 || phoneNumber.includes("8851922375");
      
      if (isAccountFound) {
        // Mock "account found" response
        const mockResponse = {
          "id": 116466142,
          "phone_number": phoneNumber,
          "continue_in_webview_ui": {
            "path": "/signin/password",
            "args": {
              "phone_number": phoneNumber,
              "account_recovery_via_email_enabled": false
            }
          }
        };
        return NextResponse.json(mockResponse);
      } else {
        // Mock "not found" response
        const mockResponse = {
          "phone_number": phoneNumber,
          "continue_in_webview_ui": {
            "path": "/signup",
            "args": {
              "phone_number": phoneNumber
            }
          }
        };
        return NextResponse.json(mockResponse);
      }
    }
    
    // Original code below - uncomment when ready to use real API
    // Prepare the request body
    const requestBody = {
      continue_in_webview_ui_supported: true,
      phone_number: phoneNumber
    };
    
    console.log('Sending request to Pi API:', JSON.stringify(requestBody));
    
    // Call the actual API with proper headers
    const response = await fetch('https://socialchain.app/api/users/phone', {
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
      console.error('API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('API error response:', errorText);
      
      return NextResponse.json(
        { error: `API returned status ${response.status}` },
        { status: response.status }
      );
    }
    
    const responseData = await response.json();
    console.log('API response:', JSON.stringify(responseData));
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to check phone number' },
      { status: 500 }
    );
  }
}