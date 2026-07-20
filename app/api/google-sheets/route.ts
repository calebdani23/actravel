import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { message: "Google Sheets has been retired from production operations; this endpoint is permanently unavailable." },
    { status: 410 },
  );
}
