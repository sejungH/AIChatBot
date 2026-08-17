import { NextResponse } from "next/server";
import { createCollection, listCollections } from "@/lib/story-store";
import type { CharacterProfile } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await listCollections());
}

export async function POST(request: Request) {
  const body = (await request.json()) as { title?: string; world?: string; openingSituation?: string; characters?: Omit<CharacterProfile, "id">[] };
  const title = body.title?.trim();
  const world = body.world?.trim();
  const openingSituation = body.openingSituation?.trim();
  const characters = body.characters?.map((character) => ({ id: crypto.randomUUID(), name: character.name.trim(), description: character.description.trim() })).filter((character) => character.name && character.description) ?? [];
  if (!title || !world || !openingSituation || characters.length === 0) return NextResponse.json({ error: "제목, 세계관, 시작 장면, 캐릭터 한 명 이상을 입력해 주세요." }, { status: 400 });
  return NextResponse.json(await createCollection(title, world, openingSituation, characters), { status: 201 });
}