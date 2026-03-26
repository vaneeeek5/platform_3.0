import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const counterId = searchParams.get("counterId");

  if (!token || !counterId) {
    return NextResponse.json({ error: "Token and Counter ID are required" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api-metrika.yandex.net/management/v1/counter/${counterId}/goals`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData.message || "Failed to fetch goals from Yandex" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data.goals || []);
  } catch (error) {
    console.error("Yandex API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
