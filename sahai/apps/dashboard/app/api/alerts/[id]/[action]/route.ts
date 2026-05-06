import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const ALLOWED_ACTIONS = new Set(["ack", "dispatch", "resolve"]);

/**
 * Proxies state transitions (ack / dispatch / resolve) on a severe alert.
 * The dashboard JWT cookie is forwarded as a Bearer token; the backend
 * verifies the ANM identity before mutating.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; action: string } }
): Promise<NextResponse> {
  if (!ALLOWED_ACTIONS.has(params.action)) {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  const token = request.cookies.get("sahai_dashboard_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = await request.text();
  const res = await fetch(
    `${BACKEND_URL}/api/alerts/${encodeURIComponent(params.id)}/${params.action}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body || "{}",
    }
  );
  const payload = await res.json().catch(() => ({}));
  return NextResponse.json(payload, { status: res.status });
}
