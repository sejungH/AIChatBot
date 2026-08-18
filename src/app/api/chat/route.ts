import { NextResponse } from "next/server";
import { createRoleplayReply, summarizeStory } from "@/lib/gemini";
import { getConversation, saveConversation } from "@/lib/story-store";
import type { Message } from "@/lib/types";

export const runtime = "nodejs";

function getIds(request: Request) {
  const url = new URL(request.url);
  return { collectionId: url.searchParams.get("collectionId"), characterId: url.searchParams.get("characterId"), playerCharacterId: url.searchParams.get("playerCharacterId") };
}

export async function GET(request: Request) {
  const { collectionId, characterId, playerCharacterId } = getIds(request);
  if (!collectionId || !characterId || !playerCharacterId) return NextResponse.json({ error: "대화 대상을 선택해 주세요." }, { status: 400 });
  const conversation = await getConversation(collectionId, characterId, playerCharacterId);
  if (!conversation) return NextResponse.json({ error: "대화 대상을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(conversation.state);
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { collectionId, characterId, playerCharacterId } = getIds(request);
    console.info(`[chat:${requestId}] 요청 수신`, { collectionId, characterId, playerCharacterId });
    if (!collectionId || !characterId || !playerCharacterId) return NextResponse.json({ error: "대화 대상을 선택해 주세요." }, { status: 400 });
    const body = (await request.json()) as { message?: string };
    const message = body.message?.trim();
    if (!message) return NextResponse.json({ error: "메시지를 입력해 주세요." }, { status: 400 });

    const conversation = await getConversation(collectionId, characterId, playerCharacterId);
    if (!conversation) return NextResponse.json({ error: "대화 대상을 찾을 수 없습니다." }, { status: 404 });
    const { state, collection } = conversation;
    const playerCharacter = collection.playerCharacters.find((item) => item.id === playerCharacterId);
    if (!playerCharacter) return NextResponse.json({ error: "플레이어 캐릭터를 찾을 수 없습니다." }, { status: 404 });
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: message, createdAt: new Date().toISOString() };
    state.messages.push(userMessage);
    const reply = await createRoleplayReply(state, message, playerCharacter);
    state.sceneStatus = reply.sceneStatus;
    state.messages.push({ id: crypto.randomUUID(), role: "assistant", content: reply.content, createdAt: new Date().toISOString() });

    const userMessageCount = state.messages.filter((item) => item.role === "user").length;
    if (state.summaryNeedsRefresh) {
      state.summary = await summarizeStory(state.messages, playerCharacter);
      state.lastSummarizedUserMessageCount = userMessageCount;
      state.lastSummarizedMessageCount = state.messages.length;
      state.summaryNeedsRefresh = false;
    } else if (userMessageCount - state.lastSummarizedUserMessageCount >= 8) {
      const newSummary = await summarizeStory(state.messages.slice(state.lastSummarizedMessageCount), playerCharacter);
      state.summary = state.summary === "아직 이야기가 시작되지 않았습니다." ? newSummary : `${state.summary}\n\n${newSummary}`;
      state.lastSummarizedUserMessageCount = userMessageCount;
      state.lastSummarizedMessageCount = state.messages.length;
    }
    await saveConversation(collectionId, characterId, playerCharacterId, state);
    console.info(`[chat:${requestId}] 응답 저장 완료`, { messageCount: state.messages.length });
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "대화를 생성하지 못했습니다.";
    console.error(`[chat:${requestId}] 요청 실패`, error);
    return NextResponse.json({ error: message, requestId }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { collectionId, characterId, playerCharacterId } = getIds(request);
  const { messageId } = (await request.json()) as { messageId?: string };
  if (!collectionId || !characterId || !playerCharacterId || !messageId) return NextResponse.json({ error: "수정할 메시지를 찾을 수 없습니다." }, { status: 400 });
  const conversation = await getConversation(collectionId, characterId, playerCharacterId);
  if (!conversation) return NextResponse.json({ error: "대화 대상을 찾을 수 없습니다." }, { status: 404 });
  const { state } = conversation;
  const messageIndex = state.messages.findIndex((message) => message.id === messageId && message.role === "user");
  const isLastUserMessage = messageIndex !== -1 && !state.messages.slice(messageIndex + 1).some((message) => message.role === "user");
  if (!isLastUserMessage) return NextResponse.json({ error: "가장 최근에 보낸 메시지만 수정할 수 있습니다." }, { status: 400 });
  const requiresSummaryRefresh = messageIndex < state.lastSummarizedMessageCount;
  state.messages = state.messages.slice(0, messageIndex);
  if (requiresSummaryRefresh) {
    state.summary = "아직 이야기가 시작되지 않았습니다.";
    state.lastSummarizedUserMessageCount = 0;
    state.lastSummarizedMessageCount = 0;
    state.summaryNeedsRefresh = true;
  }
  await saveConversation(collectionId, characterId, playerCharacterId, state);
  return NextResponse.json(state);
}