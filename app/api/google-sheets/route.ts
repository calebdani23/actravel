import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { message: "Google Sheets sync runs from server-side quote intake; this public endpoint is intentionally disabled." },
    { status: 501 },
  );
}
