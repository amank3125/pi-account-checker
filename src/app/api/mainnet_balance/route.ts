import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json(
      { error: "No authorization token" },
      { status: 401 }
    );
  }

  try {
    const response = await fetch(
      "https://socialchain.app/api/mainnet_balance",
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
          Accept: "application/json, text/plain, */*",
          Origin: "https://socialchain.app",
          Referer: "https://socialchain.app/",
          Host: "socialchain.app",
        },
      }
    );

    if (!response.ok) {
      console.error(
        "Mainnet balance API error:",
        response.status,
        response.statusText
      );
      const errorText = await response.text();
      console.error("Mainnet balance API error response:", errorText);

      return NextResponse.json(
        { error: `Failed to fetch mainnet balance: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Mainnet balance Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch mainnet balance" },
      { status: 500 }
    );
  }
}
