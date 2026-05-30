import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Home,
  Images,
  LayoutGrid,
  Loader2,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  WandSparkles,
} from "lucide-react";
import { api } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import BoardSidebar from "../components/BoardSidebar";
import BoardCardGrid from "../components/BoardCardGrid";
import BoardSkeleton from "../components/BoardSkeleton";
import CreateBoardModal from "../components/CreateBoardModal";
import ExploreLibrary from "../components/ExploreLibrary";
import ExploreUsers from "../components/ExploreUsers";
import MasonryGrid from "../components/MasonryGrid";
import PinPreviewModal from "../components/PinPreviewModal";
import ProfileSettingsModal from "../components/ProfileSettingsModal";
import RecommendationStrip from "../components/RecommendationStrip";
import UploadModal from "../components/UploadModal";

export default function BoardApp({
  boards,
  activeBoard,
  activeBoardId,
  error,
  onSelectBoard,
  onBoardsChange,
  onBoardCreated,
  onBackHome,
  user,
}) {
  const [pins, setPins] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [mobileBoardsOpen, setMobileBoardsOpen] = useState(false);
  const [localError, setLocalError] = useState("");
  const [activeView, setActiveView] = useState("organizer");
  const [pinterestConfigured, setPinterestConfigured] = useState(false);
  const [pinterestBoardId, setPinterestBoardId] = useState("");
  const [savingPinterestBoard, setSavingPinterestBoard] = useState(false);
  const [pinterestMessage, setPinterestMessage] = useState("");
  const [publishingPinId, setPublishingPinId] = useState("");
  const [previewPin, setPreviewPin] = useState(null);
  const loadRequestId = useRef(0);
  const mobileNavItems = [
    { id: "organizer", label: "Boards", icon: Home },
    { id: "explore", label: "Explore", icon: Images },
    { id: "users", label: "People", icon: Users },
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "suggestions", label: "AI", icon: WandSparkles },
  ];

  async function loadBoard(boardId = activeBoardId) {
    if (!boardId) return;
    const requestId = loadRequestId.current + 1;
    loadRequestId.current = requestId;
    setLoadingBoard(true);
    setLocalError("");
    try {
      const data = await api.getBoard(boardId);
      if (requestId !== loadRequestId.current) return;
      setPins(data.pins);
      setRecommendations(data.recommendations);
    } catch (err) {
      if (requestId !== loadRequestId.current) return;
      setLocalError(err.message || "Unable to load this board.");
    } finally {
      if (requestId === loadRequestId.current) setLoadingBoard(false);
    }
  }

  useEffect(() => {
    loadBoard();
  }, [activeBoardId]);

  useEffect(() => {
    let mounted = true;
    api
      .getPinterestStatus()
      .then((data) => {
        if (mounted) setPinterestConfigured(Boolean(data.configured));
      })
      .catch(() => {
        if (mounted) setPinterestConfigured(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setPinterestBoardId(activeBoard?.pinterestBoardId || "");
    setPinterestMessage("");
  }, [activeBoard?.id, activeBoard?.pinterestBoardId]);

  async function refresh(preferredBoardId = activeBoardId) {
    await onBoardsChange(preferredBoardId);
    await loadBoard(preferredBoardId);
  }

  async function handlePinSaved(boardId, pin) {
    if (!pin) {
      setPins([]);
      await onBoardsChange();
      return;
    }
    if (pin?.boardId === boardId) {
      setPins((currentPins) => [pin, ...currentPins.filter((item) => item.id !== pin.id)]);
    }
    await refresh(boardId);
  }

  async function movePin(pinId, boardId) {
    setLocalError("");
    try {
      await api.movePin(pinId, boardId);
      await refresh(boardId);
    } catch (err) {
      setLocalError(err.message || "Unable to move this pin.");
    }
  }

  async function editActiveBoard() {
    if (!activeBoard) return;
    const name = window.prompt("Board name", activeBoard.name);
    if (name === null) return;
    const description = window.prompt("Board description", activeBoard.description || "") ?? activeBoard.description;
    const tags = window.prompt("Keywords/tags, comma separated", (activeBoard.tags || []).join(", ")) ?? (activeBoard.tags || []).join(", ");
    const visibilityPrompt = window.prompt("Visibility: private or public", activeBoard.visibility || "private");
    const visibility = visibilityPrompt ?? activeBoard.visibility ?? "private";
    setLocalError("");
    try {
      const { board } = await api.updateBoard(activeBoard.id, {
        name,
        description,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        visibility: visibility.trim().toLowerCase(),
      });
      await onBoardCreated(board);
    } catch (err) {
      setLocalError(err.message || "Unable to update this board.");
    }
  }

  async function deleteActiveBoard() {
    if (!activeBoard) return;
    const ok = window.confirm(`Delete "${activeBoard.name}" and its pins? This cannot be undone.`);
    if (!ok) return;
    setLocalError("");
    try {
      await api.deleteBoard(activeBoard.id);
      setPins([]);
      await onBoardsChange();
    } catch (err) {
      setLocalError(err.message || "Unable to delete this board.");
    }
  }

  async function updatePinDetails(pin) {
    const title = window.prompt("Pin title", pin.title);
    if (title === null) return;
    const caption = window.prompt("Pin description", pin.caption || "") ?? pin.caption;
    const tags = window.prompt("Pin tags, comma separated", (pin.tags || []).join(", ")) ?? (pin.tags || []).join(", ");
    setLocalError("");
    try {
      const { pin: updatedPin } = await api.updatePin(pin.id, {
        title,
        caption,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
      setPins((currentPins) => currentPins.map((item) => (item.id === updatedPin.id ? updatedPin : item)));
      await refresh(activeBoardId);
    } catch (err) {
      setLocalError(err.message || "Unable to update this pin.");
    }
  }

  async function deletePin(pin) {
    const ok = window.confirm(`Delete "${pin.title}"?`);
    if (!ok) return;
    setLocalError("");
    try {
      await api.deletePin(pin.id);
      setPins((currentPins) => currentPins.filter((item) => item.id !== pin.id));
      await refresh(activeBoardId);
    } catch (err) {
      setLocalError(err.message || "Unable to delete this pin.");
    }
  }

  async function savePinterestBoardId() {
    if (!activeBoard?.id || savingPinterestBoard) return;
    setSavingPinterestBoard(true);
    setLocalError("");
    setPinterestMessage("");
    try {
      const data = await api.updateBoardPinterest(activeBoard.id, pinterestBoardId);
      await onBoardCreated(data.board);
      setPinterestMessage("Pinterest board ID saved.");
    } catch (err) {
      setLocalError(err.message || "Unable to save Pinterest board settings.");
    } finally {
      setSavingPinterestBoard(false);
    }
  }

  async function publishPinToPinterest(pinId) {
    if (publishingPinId) return;
    setPublishingPinId(pinId);
    setLocalError("");
    try {
      const data = await api.publishPinterestPin(pinId);
      setPins((currentPins) => currentPins.map((pin) => (pin.id === pinId ? data.pin : pin)));
      await refresh(activeBoardId);
    } catch (err) {
      setLocalError(err.message || "Unable to publish this pin to Pinterest.");
      await loadBoard(activeBoardId);
    } finally {
      setPublishingPinId("");
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed left-[22rem] top-10 h-80 w-80 rounded-full bg-ember/10 blur-3xl" />
      <div className="pointer-events-none fixed bottom-8 right-8 h-96 w-96 rounded-full bg-moss/10 blur-3xl" />
      <BoardSidebar
        boards={boards}
        activeBoardId={activeBoardId}
        activeView={activeView}
        onViewChange={setActiveView}
        onSelectBoard={onSelectBoard}
        onCreateBoard={() => setShowCreateBoard(true)}
        onProfileSettings={() => setShowProfileSettings(true)}
        onBackHome={onBackHome}
        user={user}
      />

      <section className="relative min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-white/60 bg-white/45 px-4 py-4 shadow-sm backdrop-blur-2xl sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={onBackHome} className="grid h-10 w-10 place-items-center rounded-full bg-white/70 shadow-sm ring-1 ring-white/70 hover:-translate-y-0.5 lg:hidden">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setMobileBoardsOpen(!mobileBoardsOpen)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/70 shadow-sm ring-1 ring-white/70 hover:-translate-y-0.5 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase text-ember">
                  {activeView === "explore" ? "Image discovery" : activeView === "users" ? "User discovery" : "Smart board"}
                </p>
                <h1 className="truncate text-2xl font-black sm:text-4xl">
                  {activeView === "explore" ? "Explore" : activeView === "users" ? "People" : activeBoard?.name || "Boards"}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-2 rounded-2xl bg-white/65 px-2 py-2 shadow-sm ring-1 ring-white/70 lg:hidden">
                {user?.user_metadata?.avatar_url || user?.user_metadata?.picture ? (
                  <img
                    src={user.user_metadata.avatar_url || user.user_metadata.picture}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-black text-white">
                    {(user?.email || "P")[0].toUpperCase()}
                  </span>
                )}
                <button
                  onClick={() => setShowProfileSettings(true)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/70 text-black/55 hover:bg-black/5"
                  aria-label="Profile settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/70 text-black/55 hover:bg-blush hover:text-ember"
                  aria-label="Log out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </span>
              <button
                onClick={() => setShowCreateBoard(true)}
                className="hidden items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 font-black shadow-sm ring-1 ring-white/70 backdrop-blur-xl hover:-translate-y-0.5 sm:inline-flex"
              >
                <Plus className="h-4 w-4" />
                Board
              </button>
              <button
                onClick={() => setShowUpload(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-ember px-4 py-3 font-black text-white shadow-lift hover:-translate-y-0.5 hover:shadow-soft"
              >
                <UploadCloud className="h-4 w-4" />
                Save
              </button>
            </div>
          </div>
          {mobileBoardsOpen ? (
            <div className="mx-auto mt-4 grid max-w-7xl grid-cols-2 gap-2 sm:grid-cols-4 lg:hidden">
              <button
                onClick={() => {
                  setShowCreateBoard(true);
                  setMobileBoardsOpen(false);
                }}
                className="rounded-2xl border border-dashed border-ember/35 bg-white/70 px-3 py-3 text-left text-sm font-black text-ember shadow-sm ring-1 ring-white/70 backdrop-blur-xl"
              >
                + New board
              </button>
              {boards.map((board) => (
                <button
                  key={board.id}
                  onClick={() => {
                    onSelectBoard(board.id);
                    setMobileBoardsOpen(false);
                  }}
                  className={`rounded-2xl px-3 py-3 text-left text-sm font-black shadow-sm ring-1 ring-white/70 backdrop-blur-xl ${
                    activeBoardId === board.id ? "bg-blush text-ember" : "bg-white/70"
                  }`}
                >
                  {board.name}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-6">
          {error || localError ? <div className="mb-4 rounded-2xl bg-blush p-4 font-bold text-ember">{localError || error}</div> : null}

          {activeView !== "explore" && activeView !== "users" ? (
            <section className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="glass-panel p-5">
                <p className="text-sm font-black uppercase text-ember">{activeBoard?.pinCount ?? pins.length} saved pins</p>
                <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${activeBoard?.visibility === "public" ? "bg-moss/10 text-moss" : "bg-black/5 text-black/45"}`}>
                  {activeBoard?.visibility === "public" ? "Public board" : "Private board"}
                </span>
                <h2 className="mt-1 text-3xl font-black">
                  {activeBoard?.description || "Start by exploring images and Smart Saving your first idea."}
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {activeBoard?.tags?.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/70 bg-white/55 px-3 py-1.5 text-xs font-black text-black/55 shadow-sm backdrop-blur-xl">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={editActiveBoard}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 text-sm font-black text-black/60 shadow-sm ring-1 ring-white/70"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Board
                  </button>
                  <button
                    type="button"
                    onClick={deleteActiveBoard}
                    className="inline-flex items-center gap-2 rounded-2xl bg-blush px-4 py-3 text-sm font-black text-ember shadow-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Board
                  </button>
                </div>
              </div>
              <div className="ai-gradient rounded-[2rem] p-5 text-white shadow-soft">
                <Sparkles className="mb-4 h-6 w-6 text-marigold" />
                <p className="text-sm font-bold leading-6 text-white/70">Learning simulation</p>
                <h3 className="mt-2 text-2xl font-black">Every correction becomes a stronger signal for the next prediction.</h3>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {["Caption", "Visual", "History"].map((item) => (
                    <span key={item} className="rounded-2xl bg-white/12 px-3 py-2 text-center text-xs font-black text-white/80">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {activeView !== "explore" && activeView !== "users" && activeBoard ? (
            <section className="mb-6 rounded-[2rem] border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-ember" />
                    <p className="text-xs font-black uppercase text-ember">Pinterest publishing</p>
                    {pinterestConfigured ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-moss/10 px-2 py-1 text-[11px] font-black text-moss">
                        <CheckCircle2 className="h-3 w-3" />
                        configured
                      </span>
                    ) : (
                      <span className="rounded-full bg-black/5 px-2 py-1 text-[11px] font-black text-black/45">
                        coming soon
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-black/55">
                    Add the matching Pinterest Board ID for this PinMind board, then publish saved pins from their cards.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
                  <input
                    value={pinterestBoardId}
                    onChange={(event) => setPinterestBoardId(event.target.value)}
                    placeholder="Pinterest Board ID"
                    className="min-w-0 flex-1 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-ember"
                    disabled={!pinterestConfigured || savingPinterestBoard}
                  />
                  <button
                    type="button"
                    onClick={savePinterestBoardId}
                    disabled={!pinterestConfigured || savingPinterestBoard}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft disabled:translate-y-0 disabled:bg-black/10 disabled:text-black/35 disabled:shadow-none"
                  >
                    {savingPinterestBoard ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save
                  </button>
                </div>
              </div>
              {pinterestMessage ? <p className="mt-3 text-sm font-bold text-moss">{pinterestMessage}</p> : null}
              {!pinterestConfigured ? (
                <p className="mt-3 text-sm font-bold text-black/45">
                  Pinterest publishing is disabled until the backend has `PINTEREST_ACCESS_TOKEN` configured.
                </p>
              ) : null}
            </section>
          ) : null}

          {activeView === "explore" ? (
            <ExploreLibrary boards={boards} onSaved={handlePinSaved} onBoardCreated={onBoardCreated} />
          ) : activeView === "users" ? (
            <ExploreUsers />
          ) : loadingBoard ? (
            <BoardSkeleton />
          ) : (
            <>
              {activeView === "organizer" || activeView === "overview" ? (
                <BoardCardGrid boards={boards} activeBoardId={activeBoardId} onSelectBoard={onSelectBoard} />
              ) : null}
              {activeView === "organizer" ? (
                <MasonryGrid
                  pins={pins}
                  boards={boards}
                  activeBoard={activeBoard}
                  pinterestConfigured={pinterestConfigured}
                  publishingPinId={publishingPinId}
                  onMovePin={movePin}
                  onUpdatePin={updatePinDetails}
                  onDeletePin={deletePin}
                  onPreviewPin={setPreviewPin}
                  onPublishPinterest={publishPinToPinterest}
                />
              ) : null}
              {activeView === "organizer" || activeView === "suggestions" ? (
                <RecommendationStrip recommendations={recommendations} />
              ) : null}
              {activeView === "suggestions" && !recommendations.length ? (
                <div className="rounded-[2rem] border border-dashed border-black/15 bg-white p-10 text-center">
                  <p className="text-lg font-black">No AI suggestions yet</p>
                  <p className="mt-2 text-sm font-semibold text-black/50">
                    Save a few pins to this board and PinMind will surface similar ideas here.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      {showUpload ? (
        <UploadModal
          boards={boards}
          onClose={() => setShowUpload(false)}
          onSaved={handlePinSaved}
          onBoardCreated={onBoardCreated}
        />
      ) : null}
      {showCreateBoard ? <CreateBoardModal onClose={() => setShowCreateBoard(false)} onCreated={onBoardCreated} /> : null}
      {showProfileSettings ? <ProfileSettingsModal user={user} onClose={() => setShowProfileSettings(false)} /> : null}
      {previewPin ? (
        <PinPreviewModal
          pin={previewPin}
          boardName={boards.find((board) => board.id === previewPin.boardId)?.name}
          onClose={() => setPreviewPin(null)}
        />
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/82 px-2 py-2 shadow-[0_-16px_50px_rgba(23,20,18,0.12)] backdrop-blur-2xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-6 gap-1">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-black ${
                  active ? "bg-ink text-white" : "text-black/50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl bg-ember px-1 text-[11px] font-black text-white"
          >
            <UploadCloud className="h-4 w-4" />
            Save
          </button>
        </div>
      </nav>
    </div>
  );
}
