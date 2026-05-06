import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

/**
 * Proxies a single protocol-rule lookup so the dashboard can show rule
 * citations (rationale, source document) without exposing the backend URL.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const res = await fetch(
    `${BACKEND_URL}/api/protocols/v1/rule/${encodeURIComponent(params.id)}`,
    { cache: "no-store" }
  );
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
