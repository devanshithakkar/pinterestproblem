import { useEffect, useState } from "react";
import { ArrowLeft, Menu, Plus, Sparkles, UploadCloud } from "lucide-react";
import { api } from "../lib/api";
import BoardSidebar from "../components/BoardSidebar";
import BoardCardGrid from "../components/BoardCardGrid";
import BoardSkeleton from "../components/BoardSkeleton";
import CreateBoardModal from "../components/CreateBoardModal";
import MasonryGrid from "../components/MasonryGrid";
import RecommendationStrip from "../components/RecommendationStrip";
import UploadModal from "../components/UploadModal";

export default function BoardApp({ boards, activeBoard, activeBoardId, error, onSelectBoard, onBoardsChange, onBackHome }) {
  const [pins, setPins] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [mobileBoardsOpen, setMobileBoardsOpen] = useState(false);

  async function loadBoard(boardId = activeBoardId) {
    if (!boardId) return;
    setLoadingBoard(true);
    const data = await api.getBoard(boardId);
    setPins(data.pins);
    setRecommendations(data.recommendations);
    setLoadingBoard(false);
  }

  useEffect(() => {
    loadBoard();
  }, [activeBoardId]);

  async function refresh(preferredBoardId = activeBoardId) {
    await onBoardsChange(preferredBoardId);
    await loadBoard(preferredBoardId);
  }

  async function movePin(pinId, boardId) {
    await api.movePin(pinId, boardId);
    await refresh(boardId);
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed left-[22rem] top-10 h-80 w-80 rounded-full bg-ember/10 blur-3xl" />
      <div className="pointer-events-none fixed bottom-8 right-8 h-96 w-96 rounded-full bg-moss/10 blur-3xl" />
      <BoardSidebar
        boards={boards}
        activeBoardId={activeBoardId}
        onSelectBoard={onSelectBoard}
        onCreateBoard={() => setShowCreateBoard(true)}
        onBackHome={onBackHome}
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
          {error ? <div className="mb-4 rounded-2xl bg-blush p-4 font-bold text-ember">{error}</div> : null}

          <section className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="glass-panel p-5">
              <p className="text-sm font-black uppercase text-ember">{activeBoard?.pinCount || pins.length} saved pins</p>
              <h2 className="mt-1 text-3xl font-black">{activeBoard?.description}</h2>
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
              <BoardCardGrid boards={boards} activeBoardId={activeBoardId} onSelectBoard={onSelectBoard} />
              <MasonryGrid pins={pins} boards={boards} onMovePin={movePin} />
              <RecommendationStrip recommendations={recommendations} />
            </>
          )}
        </div>
      </section>

      {showUpload ? <UploadModal boards={boards} onClose={() => setShowUpload(false)} onSaved={refresh} /> : null}
      {showCreateBoard ? <CreateBoardModal onClose={() => setShowCreateBoard(false)} onCreated={refresh} /> : null}
    </div>
  );
}
