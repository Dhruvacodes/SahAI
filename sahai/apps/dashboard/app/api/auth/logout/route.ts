import { NextResponse } from "next/server";

/**
 * Clears the dashboard auth cookie for local logout.
 *
 * @returns Logout confirmation response.
 */
export async function POST() {
  const response = NextResponse.json({ status: "logged_out" });
  response.cookies.set("sahai_dashboard_token", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  return response;
}

