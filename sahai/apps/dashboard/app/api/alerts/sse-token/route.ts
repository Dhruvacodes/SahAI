import { NextRequest, NextResponse } from "next/server";

/**
 * Returns the dashboard JWT in plaintext so the client can attach it as a
 * `?token=` query param when opening the EventSource connection. The cookie
 * is `httpOnly`, so client JS cannot read it directly. EventSource also
 * cannot send custom headers in browsers — hence this short hop.
 *
 * The token's lifetime is the same as the cookie (8h by default), so we
 * are not exposing anything new — just unwrapping the cookie for SSE use.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get("sahai_dashboard_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ token });
}
