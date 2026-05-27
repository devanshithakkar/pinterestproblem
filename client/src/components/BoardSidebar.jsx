import { GalleryVerticalEnd, Home, LayoutGrid, Plus, Search, Sparkles, WandSparkles } from "lucide-react";

export default function BoardSidebar({ boards, activeBoardId, onSelectBoard, onCreateBoard, onBackHome }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[21rem] shrink-0 border-r border-white/60 bg-white/42 p-5 shadow-[20px_0_80px_rgba(23,20,18,0.08)] backdrop-blur-2xl lg:block">
      <button onClick={onBackHome} className="mb-7 flex items-center gap-3 rounded-3xl p-2 text-left hover:bg-white/55">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ember text-lg font-black text-white shadow-lift">P</span>
        <span>
          <strong className="block text-xl">PinMind</strong>
          <span className="text-sm font-semibold text-black/50">Visual intelligence OS</span>
        </span>
      </button>

      <div className="mb-5 flex items-center gap-2 rounded-2xl border border-white/70 bg-white/58 px-3 py-2 shadow-sm backdrop-blur-xl focus-within:ring-2 focus-within:ring-ember/25">
        <Search className="h-4 w-4 text-black/40" />
        <input className="w-full bg-transparent text-sm outline-none" placeholder="Search boards" />
      </div>

      <nav className="space-y-2" aria-label="Workspace navigation">
        <button className="flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-left text-white shadow-soft hover:-translate-y-0.5">
          <Home className="h-4 w-4" />
          <span className="font-bold">Smart organizer</span>
        </button>
        <button className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-bold text-black/55 hover:bg-white/55">
          <LayoutGrid className="h-4 w-4 text-ember" />
          Board overview
        </button>
        <button className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-bold text-black/55 hover:bg-white/55">
          <WandSparkles className="h-4 w-4 text-moss" />
          AI suggestions
        </button>
      </nav>

      <div className="my-5 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />

      <div className="mb-3 flex items-center justify-between px-2">
        <p className="text-xs font-black uppercase text-black/42">Boards</p>
        <GalleryVerticalEnd className="h-4 w-4 text-black/35" />
      </div>

      <nav className="space-y-2" aria-label="Boards">
        {boards.map((board) => (
          <button
            key={board.id}
            onClick={() => onSelectBoard(board.id)}
            className={`group flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ${
              activeBoardId === board.id
                ? "bg-white/78 text-ember shadow-sm ring-1 ring-ember/15"
                : "text-black/70 hover:-translate-y-0.5 hover:bg-white/58 hover:shadow-sm"
            }`}
          >
            <span>
              <strong className="block">{board.name}</strong>
              <span className="text-xs font-semibold text-black/45">{board.pinCount} saved pins</span>
            </span>
            <span className="flex -space-x-2">
              {board.previews.slice(0, 3).map((src) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="h-8 w-8 rounded-full border-2 border-white object-cover transition group-hover:scale-110"
                />
              ))}
            </span>
          </button>
        ))}
      </nav>

      <button
        onClick={onCreateBoard}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-ember/40 bg-white/50 px-4 py-3 font-black text-ember shadow-sm backdrop-blur-xl hover:-translate-y-0.5 hover:bg-blush"
      >
        <Plus className="h-4 w-4" />
        New board
      </button>

      <div className="ai-gradient mt-7 rounded-3xl p-4 text-white shadow-soft">
        <Sparkles className="mb-3 h-5 w-5 text-marigold" />
        <p className="text-sm font-bold leading-6 text-white/82">
          Manual corrections are saved as learning signals, so similar pins lean toward the boards you actually choose.
        </p>
      </div>
    </aside>
  );
}
