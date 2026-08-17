import { NextResponse } from "next/server";
import { getConversation, saveConversation } from "@/lib/story-store";

export const runtime = "nodejs";

function getIds(request: Request) {
  const url = new URL(request.url);
  return { collectionId: url.searchParams.get("collectionId"), characterId: url.searchParams.get("characterId"), playerCharacterId: url.searchParams.get("playerCharacterId") };
}

export async function POST(request: Request) {
  const { collectionId, characterId, playerCharacterId } = getIds(request);
  if (!collectionId || !characterId || !playerCharacterId) return NextResponse.json({ error: "대화 대상을 선택해 주세요." }, { status: 400 });
  const { memory } = (await request.json()) as { memory?: string };
  const value = memory?.trim();
  if (!value) return NextResponse.json({ error: "기억 내용을 입력해 주세요." }, { status: 400 });
  const conversation = await getConversation(collectionId, characterId, playerCharacterId);
  if (!conversation) return NextResponse.json({ error: "대화 대상을 찾을 수 없습니다." }, { status: 404 });
  const { state } = conversation;
  if (!state.pinnedMemories.includes(value)) state.pinnedMemories.push(value);
  await saveConversation(collectionId, characterId, playerCharacterId, state);
  return NextResponse.json(state);
}

export async function DELETE(request: Request) {
  const { collectionId, characterId, playerCharacterId } = getIds(request);
  if (!collectionId || !characterId || !playerCharacterId) return NextResponse.json({ error: "대화 대상을 선택해 주세요." }, { status: 400 });
  const { memory } = (await request.json()) as { memory?: string };
  const conversation = await getConversation(collectionId, characterId, playerCharacterId);
  if (!conversation) return NextResponse.json({ error: "대화 대상을 찾을 수 없습니다." }, { status: 404 });
  const { state } = conversation;
  state.pinnedMemories = state.pinnedMemories.filter((item) => item !== memory);
  await saveConversation(collectionId, characterId, playerCharacterId, state);
  return NextResponse.json(state);
}