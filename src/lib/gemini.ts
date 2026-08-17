import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Message, PlayerCharacter, SceneStatus, StoryState } from "@/lib/types";

const modelName = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
const fallbackModelNames = ["gemini-3.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

function createModel(model: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model });
}

function getFallbackModels() {
  return [modelName, ...fallbackModelNames].filter((value, index, array) => Boolean(value) && array.indexOf(value) === index);
}

function isModelNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /404|not found|unsupported for generateContent/i.test(message);
}

async function generateTextWithFallback(prompt: string) {
  let lastError: unknown;
  for (const model of getFallbackModels()) {
    try {
      const result = await createModel(model).generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      lastError = error;
      if (!isModelNotFoundError(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini 모델을 사용할 수 없습니다.");
}

function conversation(messages: Message[], playerCharacter: PlayerCharacter) {
  return messages
    .slice(-16)
    .map((message) => `${message.role === "user" ? playerCharacter.name : "캐릭터"}: ${message.content}`)
    .join("\n\n");
}

function replaceUserTemplate(value: string, playerCharacter: PlayerCharacter) {
  return value.replaceAll("{user}", playerCharacter.name);
}

export type RoleplayResponse = {
  content: string;
  sceneStatus: SceneStatus;
};

function parseRoleplayResponse(response: string, fallbackSceneStatus: SceneStatus): RoleplayResponse {
  const json = response.replace(/^```json\s*|\s*```$/g, "").trim();
  try {
    const parsed = JSON.parse(json) as { content?: unknown; scene?: Partial<SceneStatus> };
    if (typeof parsed.content !== "string") throw new Error("응답 본문이 없습니다.");
    return {
      content: parsed.content.trim(),
      sceneStatus: {
        date: typeof parsed.scene?.date === "string" ? parsed.scene.date : fallbackSceneStatus.date,
        time: typeof parsed.scene?.time === "string" ? parsed.scene.time : fallbackSceneStatus.time,
        location: typeof parsed.scene?.location === "string" ? parsed.scene.location : fallbackSceneStatus.location,
        situation: typeof parsed.scene?.situation === "string" ? parsed.scene.situation : fallbackSceneStatus.situation,
      },
    };
  } catch {
    return { content: response.trim(), sceneStatus: fallbackSceneStatus };
  }
}

export async function createRoleplayReply(state: StoryState, userMessage: string, playerCharacter: PlayerCharacter) {
  const recentMessages = state.messages.slice(state.lastSummarizedMessageCount);
  const command = userMessage === "/사건" ? "사건 발생" : userMessage === "/시간흐름" ? "시간 흐름" : "일반 대화";
  const prompt = `당신은 텍스트 롤플레잉의 서술자이자 아래 캐릭터입니다. 한국어로만 답하세요.

캐릭터 이름: ${state.settings.characterName}
캐릭터 설정: ${state.settings.characterDescription}
플레이어 캐릭터: ${playerCharacter.name}
플레이어 설정: ${playerCharacter.description}
세계관: ${replaceUserTemplate(state.settings.world, playerCharacter)}

대화 시작 장면:
${replaceUserTemplate(state.settings.openingSituation, playerCharacter)}

이전 이야기 요약:
${state.summary}

반드시 기억해야 할 사실:
${state.pinnedMemories.length ? state.pinnedMemories.map((memory) => `- ${memory}`).join("\n") : "- 없음"}

현재 장면 상태:
${JSON.stringify(state.sceneStatus)}

마지막 요약 이후 대화:
${conversation(recentMessages, playerCharacter) || "- 아직 없음"}

플레이어(${playerCharacter.name})의 새 행동/대사: ${userMessage}
요청 종류: ${command}

규칙:
- 캐릭터의 말투와 동기를 일관되게 유지한다.
- 플레이어의 행동을 대신 결정하거나 감정을 단정하지 않는다.
- 감각적인 장면 묘사와 선택할 여지를 자연스럽게 제공한다.
- 첫 응답에서는 대화 시작 장면의 장소, 상황, 긴장감을 자연스럽게 이어받는다.
- 요청 종류가 '사건 발생'이면 현재 상황과 세계관에 맞는 새 사건을 즉시 일으켜 긴장감 또는 선택지를 만든다.
- 요청 종류가 '시간 흐름'이면 현재 상황에 적합한 시간(몇 분에서 몇 년)을 스스로 결정해 시간을 진행하고 그 결과를 묘사한다.
- 메타 설명, 규칙 언급, 'AI'라는 표현을 사용하지 않는다.
- content에는 2~5개의 짧은 문단으로 응답한다.

반드시 아래 JSON 객체만 반환하세요. markdown 코드블록을 사용하지 마세요.
{"scene":{"date":"대략적 날짜/계절","time":"현재 시각 또는 시간대","location":"현재 위치","situation":"한 문장 현재 상황"},"content":"롤플레잉 본문"}`;
  return parseRoleplayResponse(await generateTextWithFallback(prompt), state.sceneStatus);
}

export async function summarizeStory(messages: Message[], playerCharacter: PlayerCharacter) {
  const prompt = `다음은 진행 중인 한국어 롤플레잉의 새 구간입니다. 이전 요약을 바꾸거나 반복하지 말고, 이 구간에서 새롭게 확정된 사실만 간결하게 요약하세요.
관계 변화, 사건, 장소, 소지품, 약속, 미해결 갈등을 빠뜨리지 마세요. 8개 이내의 불릿으로 작성하세요.

새 대화 구간:
${conversation(messages, playerCharacter)}`;
  return generateTextWithFallback(prompt);
}