import { NextResponse } from "next/server";
import { getAppSettings, saveAppSettings } from "@/lib/story-store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getAppSettings());
}

export async function PUT(request: Request) {
  const { geminiModel } = (await request.json()) as { geminiModel?: string };
  const model = geminiModel?.trim();
  if (!model) return NextResponse.json({ error: "Gemini 모델을 선택해 주세요." }, { status: 400 });
  const settings = { ...(await getAppSettings()), geminiModel: model };
  await saveAppSettings(settings);
  return NextResponse.json(settings);
}