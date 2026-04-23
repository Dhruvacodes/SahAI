import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.FASTAPI_BASE_URL ?? "http://localhost:8000";

/**
 * Proxies dashboard login to the FastAPI backend and stores the JWT in an httpOnly cookie.
 *
 * @param request - Incoming login request containing email and password.
 * @returns Login result with an httpOnly auth cookie on success.
 */
export async function POST(request: NextRequest) {
  const credentials = await request.json();
  const backendResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
    body: JSON.stringify(credentials),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!backendResponse.ok) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: backendResponse.status }
    );
  }

  const payload = await backendResponse.json();
  const token = payload.access_token ?? payload.token ?? payload.jwt;

  if (!token) {
    return NextResponse.json(
      { error: "Login response did not include a JWT." },
      { status: 502 }
    );
  }

  const response = NextResponse.json({
    user: payload.user ?? { email: credentials.email }
  });
  response.cookies.set("sahai_dashboard_token", token, {
    httpOnly: true,
    maxAge: 60 * 60 * 8,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  return response;
}

