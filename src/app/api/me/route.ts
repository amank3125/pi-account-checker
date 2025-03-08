import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json(
      { error: "No authorization token" },
      { status: 401 }
    );
  }

  try {
    const response = await fetch("https://socialchain.app/api/me", {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        Accept: "application/json, text/plain, */*",
        Origin: "https://app-cdn.minepi.com",
        Referer: "https://app-cdn.minepi.com/",
        Host: "socialchain.app",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`User API error ${response.status}:`, errorText);
      return NextResponse.json(
        { error: `Failed to fetch user data: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(
      "Error in user data fetch:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}
