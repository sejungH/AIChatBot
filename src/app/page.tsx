"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type {
  AppSettings,
  CollectionSummary,
  Message,
  PlayerCharacter,
  StoryState,
} from "@/lib/types";

type DraftCharacter = { name: string; description: string };
type Selection = {
  collection: CollectionSummary;
  characterId: string;
  playerCharacter: PlayerCharacter;
};

const emptyCharacter = (): DraftCharacter => ({ name: "", description: "" });

function renderStoryText(content: string) {
  const dialoguePattern = /("[^"\n]*"|“[^”\n]*”|「[^」\n]*」|『[^』\n]*』)/g;
  const dialogueOnlyPattern = /^("[^"\n]*"|“[^”\n]*”|「[^」\n]*」|『[^』\n]*』)$/;
  const parts = content.split(dialoguePattern);
  return parts.map((part, index) => {
    if (!part) return null;
    return dialogueOnlyPattern.test(part) ? <span className="spoken-dialogue" key={index}>{part}</span> : <span className="narration" key={index}>{part}</span>;
  });
}

export default function Home() {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [homeTab, setHomeTab] = useState<"worlds" | "settings">("worlds");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeCollection, setActiveCollection] =
    useState<CollectionSummary | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [state, setState] = useState<StoryState | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadCollections();
    const savedTheme = window.localStorage.getItem("story-weaver-theme");
    if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("story-weaver-theme", theme);
  }, [theme]);

  async function loadCollections() {
    const response = await fetch("/api/collections");
    setCollections(await response.json());
    setIsLoading(false);
  }

  async function openConversation(
    collection: CollectionSummary,
    characterId: string,
    playerCharacter: PlayerCharacter,
  ) {
    setSelection({ collection, characterId, playerCharacter });
    setState(null);
    const response = await fetch(
      `/api/chat?collectionId=${collection.id}&characterId=${characterId}&playerCharacterId=${playerCharacter.id}`,
    );
    if (response.ok) setState(await response.json());
  }

  async function startWorldStory(
    collection: CollectionSummary,
    playerCharacter: PlayerCharacter,
  ) {
    const firstCharacter = collection.characters[0];
    if (firstCharacter)
      await openConversation(collection, firstCharacter.id, playerCharacter);
  }

  if (selection)
    return (
      <Conversation
        selection={selection}
        state={state}
        setState={setState}
        onBack={() => {
          setSelection(null);
          setState(null);
        }}
      />
    );
  if (activeCollection)
    return (
      <PlayerSetup
        collection={activeCollection}
        onBack={() => setActiveCollection(null)}
        onSelected={(playerCharacter) =>
          void startWorldStory(activeCollection, playerCharacter)
        }
      />
    );

  return (
    <main className="library-shell">
      <header className="library-header">
        <div>
          <p className="eyebrow">INTERACTIVE FICTION</p>
          <h1>Story Weaver</h1>
          <p className="library-copy">
            당신만의 세계와 인물을 만들고, 각자의 이야기를 시작하세요.
          </p>
        </div>
        <div className="home-actions"><div className="home-tabs"><button className={homeTab === "worlds" ? "active" : ""} onClick={() => setHomeTab("worlds")}>세계관</button><button className={homeTab === "settings" ? "active" : ""} onClick={() => setHomeTab("settings")}>설정</button></div>{homeTab === "worlds" && <button className="primary-button" onClick={() => setIsCreating(true)}>캐릭터 생성</button>}</div>
      </header>
      {homeTab === "worlds" ? <section className="collection-grid">
        {isLoading ? (
          <p className="empty-state">세계관을 불러오는 중...</p>
        ) : collections.length === 0 ? (
          <div className="empty-state">
            <p>아직 만들어진 세계가 없습니다.</p>
            <button className="text-action" onClick={() => setIsCreating(true)}>
              첫 세계 만들기
            </button>
          </div>
        ) : (
          collections.map((collection) => (
            <button
              className="world-panel"
              key={collection.id}
              onClick={() => setActiveCollection(collection)}
            >
              <span className="world-panel-top">
                <small>WORLD</small>
                <span>{collection.characters.length}명의 인물</span>
              </span>
              <strong>{collection.title}</strong>
              <p>{collection.world}</p>
              <span className="card-arrow">입장 &rarr;</span>
            </button>
          ))
        )}
      </section> : <SettingsPanel theme={theme} onThemeChange={setTheme} />}
      {isCreating && (
        <CreationModal
          onClose={() => setIsCreating(false)}
          onCreated={async (collection) => {
            setIsCreating(false);
            await loadCollections();
            setActiveCollection(collection);
          }}
        />
      )}
    </main>
  );
}

function SettingsPanel({ theme, onThemeChange }: { theme: "light" | "dark"; onThemeChange: (theme: "light" | "dark") => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void (async () => { const response = await fetch("/api/settings"); if (response.ok) setSettings(await response.json()); })(); }, []);
  async function updateModel(geminiModel: string) { setIsSaving(true); setError(""); try { const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ geminiModel }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setSettings(result); } catch (reason) { setError(reason instanceof Error ? reason.message : "설정을 저장하지 못했습니다."); } finally { setIsSaving(false); } }
  return <section className="settings-panel"><div className="settings-group"><p className="section-title">테마</p><p className="helper-copy">화면에 적용할 색상 모드를 선택하세요.</p><div className="segmented-control"><button className={theme === "light" ? "active" : ""} onClick={() => onThemeChange("light")}>라이트</button><button className={theme === "dark" ? "active" : ""} onClick={() => onThemeChange("dark")}>다크</button></div></div><div className="settings-group"><p className="section-title">Gemini 모델</p><p className="helper-copy">선택한 모델은 이후 생성되는 대화와 요약부터 사용됩니다.</p><label>생성 모델<select value={settings?.geminiModel ?? "gemini-3.5-flash"} disabled={!settings || isSaving} onChange={(event) => void updateModel(event.target.value)}><option value="gemini-3.5-flash">Gemini 3.5 Flash</option><option value="gemini-2.0-flash">Gemini 2.0 Flash</option><option value="gemini-1.5-flash">Gemini 1.5 Flash</option><option value="gemini-1.5-pro">Gemini 1.5 Pro</option></select></label>{error && <p className="form-error">{error}</p>}</div></section>;
}

function PlayerSetup({
  collection,
  onBack,
  onSelected,
}: {
  collection: CollectionSummary;
  onBack: () => void;
  onSelected: (player: PlayerCharacter) => void;
}) {
  const [players, setPlayers] = useState<PlayerCharacter[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadPlayers();
  }, [collection.id]);
  async function loadPlayers() {
    const response = await fetch(`/api/players?collectionId=${collection.id}`);
    if (response.ok) setPlayers(await response.json());
  }
  async function createPlayer(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/players?collectionId=${collection.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onSelected(result);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "플레이어 캐릭터를 만들지 못했습니다.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="setup-shell">
      <header className="setup-header">
        <button className="back-button" onClick={onBack}>
          &larr; 세계관 목록
        </button>
        <p className="eyebrow">{collection.title}</p>
        <h1>당신은 누구인가요?</h1>
        <p className="world-description">
          {collection.world.replaceAll("{user}", "당신")}
        </p>
      </header>
      <div className="player-layout">
        <section className="player-form">
          <p className="section-title">플레이어 캐릭터 만들기</p>
          <p className="helper-copy">
            세계관 설정의 <code>{"{user}"}</code>는 여기서 만든 캐릭터의 이름과
            설정으로 대화에 반영됩니다.
          </p>
          <form onSubmit={createPlayer}>
            <label>
              이름
              <input
                required
                placeholder="플레이어 캐릭터 이름"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              캐릭터 설정
              <textarea
                required
                placeholder="외모, 성격, 직업, 이 세계에서의 과거와 목적을 자유롭게 적어 주세요."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button" disabled={isSaving}>
              {isSaving ? "저장 중" : "이 캐릭터로 시작"}
            </button>
          </form>
        </section>
        {players.length > 0 && (
          <section className="saved-players">
            <p className="section-title">이 세계에서 사용한 캐릭터</p>
            <p className="helper-copy">
              선택하면 이전에 진행한 모든 대화를 그대로 이어갑니다.
            </p>
            {players.map((player) => (
              <button
                className="player-card"
                key={player.id}
                onClick={() => onSelected(player)}
              >
                <strong>{player.name}</strong>
                <span>{player.description}</span>
                <small>이 캐릭터로 계속하기 &rarr;</small>
              </button>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function CreationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (collection: CollectionSummary) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [world, setWorld] = useState("");
  const [openingSituation, setOpeningSituation] = useState("");
  const [characters, setCharacters] = useState<DraftCharacter[]>([
    emptyCharacter(),
  ]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  function updateCharacter(
    index: number,
    field: keyof DraftCharacter,
    value: string,
  ) {
    setCharacters(
      characters.map((character, position) =>
        position === index ? { ...character, [field]: value } : character,
      ),
    );
  }
  async function createCollection(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, world, openingSituation, characters }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await onCreated(result);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "저장하지 못했습니다.",
      );
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="creation-modal" onSubmit={createCollection}>
        <header>
          <div>
            <p className="eyebrow">NEW STORY</p>
            <h2>세계와 인물 만들기</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="창 닫기"
            onClick={onClose}
          >
            x
          </button>
        </header>
        <div className="modal-scroll">
          <label>
            이야기 제목
            <input
              required
              placeholder="예: 비가 내리는 네레이드"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            세계관
            <textarea
              required
              placeholder="시대, 장소, 규칙, 분위기를 적어 주세요. {user}를 사용할 수 있습니다."
              value={world}
              onChange={(event) => setWorld(event.target.value)}
            />
          </label>
          <label>
            대화 시작 장면
            <textarea
              required
              placeholder="언제, 어디서, 무슨 일이 벌어지고 있나요? {user}와 인물의 관계, 감정, 목적, 긴장 요소를 자세히 적어 주세요."
              value={openingSituation}
              onChange={(event) => setOpeningSituation(event.target.value)}
            />
          </label>
          <div className="character-form-heading">
            <div>
              <p className="section-title">등장 캐릭터</p>
              <small>각 캐릭터는 별도의 대화와 기억을 가집니다.</small>
            </div>
            <button
              type="button"
              className="text-action"
              onClick={() => setCharacters([...characters, emptyCharacter()])}
            >
              + 인물 추가
            </button>
          </div>
          {characters.map((character, index) => (
            <fieldset className="character-fields" key={index}>
              <legend>인물 {index + 1}</legend>
              {characters.length > 1 && (
                <button
                  type="button"
                  className="remove-character"
                  aria-label={`인물 ${index + 1} 삭제`}
                  onClick={() =>
                    setCharacters(
                      characters.filter((_, position) => position !== index),
                    )
                  }
                >
                  삭제
                </button>
              )}
              <label>
                이름
                <input
                  required
                  placeholder="이름"
                  value={character.name}
                  onChange={(event) =>
                    updateCharacter(index, "name", event.target.value)
                  }
                />
              </label>
              <label>
                성격 및 배경
                <textarea
                  required
                  placeholder="말투, 성격, 관계, 비밀 등을 적어 주세요."
                  value={character.description}
                  onChange={(event) =>
                    updateCharacter(index, "description", event.target.value)
                  }
                />
              </label>
            </fieldset>
          ))}
        </div>
        {error && <p className="form-error">{error}</p>}
        <footer>
          <button type="button" className="secondary-button" onClick={onClose}>
            취소
          </button>
          <button className="primary-button" disabled={isSaving}>
            {isSaving ? "저장 중" : "이야기 저장"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Conversation({
  selection,
  state,
  setState,
  onBack,
}: {
  selection: Selection;
  state: StoryState | null;
  setState: (state: StoryState) => void;
  onBack: () => void;
}) {
  const [message, setMessage] = useState("");
  const [memory, setMemory] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChatChromeHidden, setIsChatChromeHidden] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const query = `collectionId=${selection.collection.id}&characterId=${selection.characterId}&playerCharacterId=${selection.playerCharacter.id}`;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.messages.length, isSending]);
  function logDebug(message: string) {
    const time = new Date().toLocaleTimeString("ko-KR", { hour12: false });
    setDebugLog((entries) => [...entries.slice(-49), `[${time}] ${message}`]);
  }
  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() || !state || isSending) return;
    const content = message.trim();
    const previousState = state;
    const optimisticMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setState({ ...state, messages: [...state.messages, optimisticMessage] });
    setMessage("");
    setIsSending(true);
    logDebug(`전송 시작: ${content.slice(0, 80)}`);
    try {
      const response = await fetch(`/api/chat?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const rawResult = await response.text();
      let result: StoryState | { error?: string; requestId?: string };
      try { result = JSON.parse(rawResult) as StoryState | { error?: string; requestId?: string }; } catch { throw new Error(`서버가 JSON이 아닌 응답을 반환했습니다: ${rawResult.slice(0, 200)}`); }
      if (!response.ok) {
        const errorResult = result as { error?: string; requestId?: string };
        throw new Error(`HTTP ${response.status}: ${errorResult.error ?? "알 수 없는 오류"}${errorResult.requestId ? ` (요청 ID: ${errorResult.requestId})` : ""}`);
      }
      logDebug(`응답 수신: HTTP ${response.status}`);
      setState(result as StoryState);
    } catch (reason) {
      setState(previousState);
      setMessage(content);
      const errorMessage = reason instanceof Error ? reason.message : "오류가 발생했습니다.";
      logDebug(`오류: ${errorMessage}`);
      setIsDebugOpen(true);
    } finally {
      setIsSending(false);
    }
  }
  async function addMemory(event: FormEvent) {
    event.preventDefault();
    if (!memory.trim()) return;
    const response = await fetch(`/api/memories?${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory }),
    });
    if (response.ok) {
      setState(await response.json());
      setMemory("");
    }
  }
  async function removeMemory(value: string) {
    const response = await fetch(`/api/memories?${query}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory: value }),
    });
    if (response.ok) setState(await response.json());
  }

  if (!state) return <main className="loading">대화를 불러오는 중...</main>;
  return (
    <main className={`shell ${isSidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className="sidebar" aria-hidden={!isSidebarOpen}>
        <button
          className="panel-icon-button sidebar-close-button"
          aria-label="설정 패널 닫기"
          title="설정 패널 닫기"
          onClick={() => setIsSidebarOpen(false)}
        >
          &times;
        </button>
        <button className="back-button" onClick={onBack}>
          &larr; 인물 목록
        </button>
        <p className="eyebrow">{selection.collection.title}</p>
        <h1>{state.settings.characterName}</h1>
        <section>
          <p className="section-title">메인 캐릭터 설정</p>
          <p className="world-copy">{state.settings.characterDescription}</p>
        </section>
        <section>
          <p className="section-title">플레이어</p>
          <p className="world-copy">
            <strong>{selection.playerCharacter.name}</strong>
            <br />
            {selection.playerCharacter.description}
          </p>
        </section>
      </aside>
      <section className={`stage ${isChatChromeHidden ? "chat-chrome-hidden" : ""}`}>
        <header>
          <div className="chat-title">
            {!isSidebarOpen && <button className="panel-icon-button" aria-label="설정 패널 열기" title="설정 패널 열기" onClick={() => setIsSidebarOpen(true)}>&#9776;</button>}
            <div>
            <p className="eyebrow">{selection.collection.title}</p>
            <h2>{state.settings.characterName}의 이야기</h2>
            </div>
          </div>
          <div className="header-actions">
            <p className="memory-count">
              {state.messages.filter((item) => item.role === "user").length % 8}{" "}
              / 8 대화 후 요약
            </p>
            <button
              className="memory-button"
              onClick={() => setIsMemoryOpen(true)}
            >
              고정 기억
            </button>
            <button className="debug-button" onClick={() => setIsDebugOpen(true)}>로그</button>
          </div>
        </header>
        <dl className="scene-status" aria-label="현재 상황">
          <div><dt>날짜</dt><dd>{state.sceneStatus.date}</dd></div>
          <div><dt>시각</dt><dd>{state.sceneStatus.time}</dd></div>
          <div><dt>위치</dt><dd>{state.sceneStatus.location}</dd></div>
          <div className="scene-situation"><dt>상황</dt><dd>{state.sceneStatus.situation}</dd></div>
        </dl>
        <div className="messages" onClick={() => setIsChatChromeHidden((isHidden) => !isHidden)}>
          <article className="message assistant opening-message">
            <p className="speaker">{state.settings.characterName}</p>
            <p>
              {renderStoryText(
                state.settings.openingSituation.replaceAll(
                  "{user}",
                  selection.playerCharacter.name,
                ),
              )}
            </p>
          </article>
          {state.messages.map((item) => (
            <article className={`message ${item.role}`} key={item.id}>
              <p className="speaker">
                {item.role === "user"
                  ? selection.playerCharacter.name
                  : state.settings.characterName}
              </p>
              <p>{renderStoryText(item.content)}</p>
            </article>
          ))}
          {isSending && (
            <div className="reply-spinner" role="status" aria-label="응답 생성 중">
              <span />
              <span>이야기를 이어 쓰는 중</span>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <form className="composer" onSubmit={sendMessage}>
          <textarea
            placeholder={`${selection.playerCharacter.name}의 말이나 행동을 적어 보세요... (/사건, /시간흐름)`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="send-button" disabled={isSending} aria-label="메시지 보내기" title="메시지 보내기">
            <i className="fa-solid fa-paper-plane" aria-hidden="true" />
          </button>
        </form>
      </section>
      {isMemoryOpen && (
        <MemoryDialog
          memories={state.pinnedMemories}
          memory={memory}
          onMemoryChange={setMemory}
          onClose={() => setIsMemoryOpen(false)}
          onAdd={addMemory}
          onRemove={removeMemory}
        />
      )}
      {isDebugOpen && <DebugDialog entries={debugLog} onClose={() => setIsDebugOpen(false)} onClear={() => setDebugLog([])} />}
    </main>
  );
}

function DebugDialog({ entries, onClose, onClear }: { entries: string[]; onClose: () => void; onClear: () => void }) {
  return <div className="modal-backdrop" role="presentation"><section className="debug-dialog" role="dialog" aria-modal="true" aria-label="디버그 로그"><header><div><p className="eyebrow">CHAT DEBUG</p><h2>전송 로그</h2></div><button className="icon-button" aria-label="창 닫기" onClick={onClose}>x</button></header><div className="debug-log">{entries.length ? entries.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>) : <p>아직 기록된 요청이 없습니다.</p>}</div><footer><button className="secondary-button" onClick={onClear}>로그 비우기</button></footer></section></div>;
}

function MemoryDialog({
  memories,
  memory,
  onMemoryChange,
  onClose,
  onAdd,
  onRemove,
}: {
  memories: string[];
  memory: string;
  onMemoryChange: (value: string) => void;
  onClose: () => void;
  onAdd: (event: FormEvent) => Promise<void>;
  onRemove: (value: string) => Promise<void>;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="memory-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="고정 기억"
      >
        <header>
          <div>
            <p className="eyebrow">PERSISTENT MEMORY</p>
            <h2>고정 기억</h2>
          </div>
          <button
            className="icon-button"
            aria-label="창 닫기"
            onClick={onClose}
          >
            x
          </button>
        </header>
        <div className="memory-dialog-content">
          <p className="helper-copy">
            여기에 적은 사실은 자동 요약과 무관하게 매 대화에 유지됩니다.
          </p>
          {memories.length === 0 ? (
            <p className="empty-memory">아직 고정한 기억이 없습니다.</p>
          ) : (
            memories.map((item) => (
              <div className="memory" key={item}>
                <span>{item}</span>
                <button
                  aria-label="기억 삭제"
                  onClick={() => void onRemove(item)}
                >
                  x
                </button>
              </div>
            ))
          )}
          <form onSubmit={(event) => void onAdd(event)}>
            <label>
              새 고정 기억
              <input
                placeholder="반드시 기억할 사실"
                value={memory}
                onChange={(event) => onMemoryChange(event.target.value)}
              />
            </label>
            <button className="primary-button">기억 추가</button>
          </form>
        </div>
      </section>
    </div>
  );
}
