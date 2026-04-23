import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.FASTAPI_BASE_URL ?? "http://localhost:8000";

/**
 * Proxies dashboard summary requests to the FastAPI backend.
 *
 * @param request - Incoming dashboard summary request.
 * @returns FastAPI dashboard summary JSON.
 */
export async function GET(request: NextRequest) {
  const anmId = request.nextUrl.searchParams.get("anmId");
  const backendResponse = await fetch(
    `${API_BASE_URL}/api/dashboard/summary?anmId=${encodeURIComponent(anmId ?? "")}`,
    { cache: "no-store" }
  );

  if (!backendResponse.ok) {
    return NextResponse.json(
      { error: "Dashboard summary unavailable." },
      { status: backendResponse.status }
    );
  }

  return NextResponse.json(await backendResponse.json());
}

