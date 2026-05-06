import { NextResponse } from "next/server";

const API_BASE_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

/**
 * Proxies district heatmap requests to the FastAPI backend.
 *
 * @returns FastAPI district heatmap JSON.
 */
export async function GET() {
  const backendResponse = await fetch(`${API_BASE_URL}/api/dashboard/district-heatmap`, {
    cache: "no-store"
  });

  if (!backendResponse.ok) {
    return NextResponse.json(
      { error: "District heatmap unavailable." },
      { status: backendResponse.status }
    );
  }

  return NextResponse.json(await backendResponse.json());
}

