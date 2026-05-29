import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Menu, Plus, Sparkles, UploadCloud } from "lucide-react";
import { api } from "../lib/api";
import BoardSidebar from "../components/BoardSidebar";
import BoardCardGrid from "../components/BoardCardGrid";
import BoardSkeleton from "../components/BoardSkeleton";
import CreateBoardModal from "../components/CreateBoardModal";
import MasonryGrid from "../components/MasonryGrid";
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
  const [mobileBoardsOpen, setMobileBoardsOpen] = useState(false);
  const [localError, setLocalError] = useState("");
  const [activeView, setActiveView] = useState("organizer");
  const loadRequestId = useRef(0);

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

  async function refresh(preferredBoardId = activeBoardId) {
    await onBoardsChange(preferredBoardId);
    await loadBoard(preferredBoardId);
  }

  async function handlePinSaved(boardId, pin) {
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
                <p className="truncate text-xs font-black uppercase text-ember">Smart board</p>
                <h1 className="truncate text-2xl font-black sm:text-4xl">{activeBoard?.name || "Boards"}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
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

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {error || localError ? <div className="mb-4 rounded-2xl bg-blush p-4 font-bold text-ember">{localError || error}</div> : null}

          <section className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="glass-panel p-5">
              <p className="text-sm font-black uppercase text-ember">{activeBoard?.pinCount ?? pins.length} saved pins</p>
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

          {loadingBoard ? (
            <BoardSkeleton />
          ) : (
            <>
              {activeView === "organizer" || activeView === "overview" ? (
                <BoardCardGrid boards={boards} activeBoardId={activeBoardId} onSelectBoard={onSelectBoard} />
              ) : null}
              {activeView === "organizer" ? <MasonryGrid pins={pins} boards={boards} onMovePin={movePin} /> : null}
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
    </div>
  );
}
