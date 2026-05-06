import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

/**
 * Proxies severe-alert list queries to the FastAPI backend.
 * Forwards the dashboard JWT cookie as a Bearer token so the backend
 * can scope the response to the supervised ASHA workers.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get("sahai_dashboard_token")?.value;
  const params = request.nextUrl.searchParams.toString();
  const url = `${BACKEND_URL}/api/alerts${params ? `?${params}` : ""}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
