import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return NextResponse.json(
      { error: "No authorization token" },
      { status: 401 }
    );
  }

  try {
    // We don't need to parse the body for this API call, but we'll
    // leave this commented in case we need it in the future
    // const body = await request.json();

    // Set up headers for the Pi Network API request
    const myHeaders = new Headers();
    myHeaders.append("Origin", "https://app-cdn.minepi.com");
    myHeaders.append("Referer", "https://app-cdn.minepi.com/");
    myHeaders.append("Content-Length", "24");
    myHeaders.append(
      "User-Agent",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
    );
    myHeaders.append("host", "socialchain.app");
    myHeaders.append("Authorization", authHeader);

    // Prepare request payload
    const raw = JSON.stringify({
      recaptcha_token: null,
    });

    // Make the request to Pi Network API
    const response = await fetch(
      "https://socialchain.app/api/proof_of_presences",
      {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow",
      }
    );

    // Check response status
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          success: false,
          error: `API returned status ${response.status}: ${errorText}`,
        },
        { status: response.status }
      );
    }

    // Parse and return the data
    const data = await response.json();
    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Error in mining API:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}
