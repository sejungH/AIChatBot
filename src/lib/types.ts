export type Role = "user" | "assistant";

export type Message = {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
};

export type StorySettings = {
  characterName: string;
  characterDescription: string;
  world: string;
  openingSituation: string;
};

export type SceneStatus = {
  date: string;
  time: string;
  location: string;
  situation: string;
};

export type AppSettings = {
  geminiModel: string;
};

export type StoryState = {
  settings: StorySettings;
  messages: Message[];
  summary: string;
  pinnedMemories: string[];
  lastSummarizedUserMessageCount: number;
  lastSummarizedMessageCount: number;
  sceneStatus: SceneStatus;
};

export type StoredConversation = Omit<StoryState, "settings">;

export type CharacterProfile = {
  id: string;
  name: string;
  description: string;
};

export type PlayerCharacter = CharacterProfile & {
  createdAt: string;
};

export type StoryCollection = {
  id: string;
  title: string;
  world: string;
  openingSituation: string;
  characters: CharacterProfile[];
  playerCharacters: PlayerCharacter[];
  conversations: Record<string, Record<string, StoredConversation>>;
  createdAt: string;
};

export type CollectionSummary = Pick<StoryCollection, "id" | "title" | "world" | "openingSituation" | "characters" | "createdAt">;