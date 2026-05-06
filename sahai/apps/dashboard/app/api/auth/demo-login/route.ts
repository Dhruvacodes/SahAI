// apps/dashboard/app/api/auth/demo-login/route.ts
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/demo-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Demo login failed" }));
      return NextResponse.json(err, { status: res.status });
    }

    const data = await res.json();
    const response = NextResponse.json(data);
    response.cookies.set("sahai_dashboard_token", data.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 30, // 30 minutes
    });
    return response;
  } catch (e) {
    return NextResponse.json({ detail: "Backend unreachable" }, { status: 502 });
  }
}
