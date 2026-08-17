import { NextResponse } from "next/server";
import { createPlayerCharacter, listPlayerCharacters } from "@/lib/story-store";

export const runtime = "nodejs";

function getCollectionId(request: Request) {
  return new URL(request.url).searchParams.get("collectionId");
}

export async function GET(request: Request) {
  const collectionId = getCollectionId(request);
  if (!collectionId) return NextResponse.json({ error: "세계관을 선택해 주세요." }, { status: 400 });
  return NextResponse.json(await listPlayerCharacters(collectionId));
}

export async function POST(request: Request) {
  const collectionId = getCollectionId(request);
  const body = (await request.json()) as { name?: string; description?: string };
  const name = body.name?.trim();
  const description = body.description?.trim();
  if (!collectionId || !name || !description) return NextResponse.json({ error: "이름과 캐릭터 설정을 입력해 주세요." }, { status: 400 });
  const playerCharacter = await createPlayerCharacter(collectionId, name, description);
  if (!playerCharacter) return NextResponse.json({ error: "세계관을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(playerCharacter, { status: 201 });
}