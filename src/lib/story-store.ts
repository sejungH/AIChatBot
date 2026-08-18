import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { AppSettings, CharacterProfile, CollectionSummary, PlayerCharacter, SceneStatus, StoredConversation, StoryCollection, StoryState } from "@/lib/types";

const dataDirectory = path.join(process.cwd(), "data");
const dataFile = path.join(dataDirectory, "story-collections.json");
const settingsFile = path.join(dataDirectory, "app-settings.json");
const defaultAppSettings: AppSettings = { geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.5-flash" };

const initialSceneStatus: SceneStatus = {
  date: "알 수 없음",
  time: "알 수 없음",
  location: "장면 시작 지점",
  situation: "이야기가 시작되기를 기다리고 있습니다.",
};

function hydrateConversation(character: CharacterProfile, world: string, openingSituation: string, stored?: StoredConversation): StoryState {
  return {
    settings: { characterName: character.name, characterDescription: character.description, world, openingSituation },
    messages: stored?.messages ?? [],
    summary: stored?.summary ?? "아직 이야기가 시작되지 않았습니다.",
    pinnedMemories: stored?.pinnedMemories ?? [],
    lastSummarizedUserMessageCount: stored?.lastSummarizedUserMessageCount ?? 0,
    lastSummarizedMessageCount: stored?.lastSummarizedMessageCount ?? 0,
    summaryNeedsRefresh: stored?.summaryNeedsRefresh ?? false,
    sceneStatus: stored?.sceneStatus ?? initialSceneStatus,
  };
}

function compactConversation(state: StoryState): StoredConversation {
  const { settings: _settings, ...stored } = state;
  return stored;
}

function isConversation(value: unknown): value is StoredConversation {
  return typeof value === "object" && value !== null && "messages" in value && Array.isArray(value.messages);
}

function hasProgress(state: StoredConversation) {
  return state.messages.length > 0 || state.pinnedMemories.length > 0 || state.summary !== "아직 이야기가 시작되지 않았습니다.";
}

function normalizeConversations(value: unknown, playerCharacters: PlayerCharacter[]): StoryCollection["conversations"] {
  if (typeof value !== "object" || value === null) return {};
  const conversations: StoryCollection["conversations"] = {};
  for (const [characterId, rawEntry] of Object.entries(value)) {
    if (isConversation(rawEntry)) {
      const legacyConversation = compactConversation(rawEntry as StoryState);
      const firstPlayer = playerCharacters[0];
      if (firstPlayer && hasProgress(legacyConversation)) conversations[characterId] = { [firstPlayer.id]: legacyConversation };
      continue;
    }
    if (typeof rawEntry !== "object" || rawEntry === null) continue;
    for (const [playerId, rawConversation] of Object.entries(rawEntry)) {
      if (!isConversation(rawConversation)) continue;
      conversations[characterId] ??= {};
      conversations[characterId][playerId] = compactConversation(rawConversation as StoryState);
    }
  }
  return conversations;
}

async function getCollections(): Promise<StoryCollection[]> {
  try {
    const collections = JSON.parse(await readFile(dataFile, "utf8")) as Array<Omit<StoryCollection, "conversations" | "playerCharacters"> & { conversations?: unknown; playerCharacters?: PlayerCharacter[] }>;
    return collections.map((collection) => {
      const playerCharacters = collection.playerCharacters ?? [];
      return { ...collection, playerCharacters, conversations: normalizeConversations(collection.conversations, playerCharacters) };
    });
  } catch {
    return [];
  }
}

async function saveCollections(collections: StoryCollection[]) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(dataFile, JSON.stringify(collections, null, 2), "utf8");
}

export async function getAppSettings(): Promise<AppSettings> {
  try {
    return { ...defaultAppSettings, ...(JSON.parse(await readFile(settingsFile, "utf8")) as Partial<AppSettings>) };
  } catch {
    return defaultAppSettings;
  }
}

export async function saveAppSettings(settings: AppSettings) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(settingsFile, JSON.stringify(settings, null, 2), "utf8");
}

export async function listCollections(): Promise<CollectionSummary[]> {
  const collections = await getCollections();
  return collections.map(({ id, title, world, openingSituation, characters, createdAt }) => ({ id, title, world, openingSituation, characters, createdAt }));
}

export async function createCollection(title: string, world: string, openingSituation: string, characters: CharacterProfile[]) {
  const collection: StoryCollection = {
    id: crypto.randomUUID(), title, world, openingSituation, characters, createdAt: new Date().toISOString(),
    playerCharacters: [],
    conversations: {},
  };
  const collections = await getCollections();
  collections.unshift(collection);
  await saveCollections(collections);
  return collection;
}

export async function listPlayerCharacters(collectionId: string) {
  return (await getCollections()).find((collection) => collection.id === collectionId)?.playerCharacters ?? [];
}

export async function createPlayerCharacter(collectionId: string, name: string, description: string) {
  const collections = await getCollections();
  const collection = collections.find((item) => item.id === collectionId);
  if (!collection) return null;
  const playerCharacter: PlayerCharacter = { id: crypto.randomUUID(), name, description, createdAt: new Date().toISOString() };
  collection.playerCharacters.push(playerCharacter);
  await saveCollections(collections);
  return playerCharacter;
}

export async function getConversation(collectionId: string, characterId: string, playerCharacterId: string) {
  const collection = (await getCollections()).find((item) => item.id === collectionId);
  if (!collection) return null;
  const character = collection.characters.find((item) => item.id === characterId);
  const playerCharacter = collection.playerCharacters.find((item) => item.id === playerCharacterId);
  if (!character || !playerCharacter) return null;
  const state = hydrateConversation(character, collection.world, collection.openingSituation, collection.conversations[characterId]?.[playerCharacterId]);
  return { collection, state };
}

export async function saveConversation(collectionId: string, characterId: string, playerCharacterId: string, state: StoryState) {
  const collections = await getCollections();
  const collection = collections.find((item) => item.id === collectionId);
  if (!collection || !collection.characters.some((item) => item.id === characterId) || !collection.playerCharacters.some((item) => item.id === playerCharacterId)) return false;
  collection.conversations[characterId] ??= {};
  collection.conversations[characterId][playerCharacterId] = compactConversation(state);
  await saveCollections(collections);
  return true;
}