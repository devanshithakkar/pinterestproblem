import { GalleryVerticalEnd, Home, LayoutGrid, LogOut, Plus, Search, Sparkles, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const navItems = [
  { id: "organizer", label: "Smart organizer", icon: Home, color: "text-white" },
  { id: "overview", label: "Board overview", icon: LayoutGrid, color: "text-ember" },
  { id: "suggestions", label: "AI suggestions", icon: WandSparkles, color: "text-moss" },
];

export default function BoardSidebar({
  boards,
  activeBoardId,
  activeView,
  onViewChange,
  onSelectBoard,
  onCreateBoard,
  onBackHome,
  user,
}) {
  const [query, setQuery] = useState("");
  const visibleBoards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return boards;
    return boards.filter((board) =>
      [board.name, board.description, ...(board.tags || [])].join(" ").toLowerCase().includes(normalized),
    );
  }, [boards, query]);

  return (
    <aside className="sticky top-0 hidden h-screen w-[21rem] shrink-0 flex-col border-r border-white/60 bg-white/42 p-5 shadow-[20px_0_80px_rgba(23,20,18,0.08)] backdrop-blur-2xl lg:flex">
      <button onClick={onBackHome} className="mb-5 flex items-center gap-3 rounded-3xl p-2 text-left hover:bg-white/55">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ember text-lg font-black text-white shadow-lift">P</span>
        <span>
          <strong className="block text-xl">PinMind</strong>
          <span className="text-sm font-semibold text-black/50">Visual intelligence OS</span>
        </span>
      </button>
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-white/55 p-2 shadow-sm ring-1 ring-white/70">
        <span className="flex min-w-0 items-center gap-2">
          {user?.user_metadata?.avatar_url || user?.user_metadata?.picture ? (
            <img src={user.user_metadata.avatar_url || user.user_metadata.picture} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-black text-white">
              {(user?.email || "P")[0].toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <strong className="block truncate text-sm">{user?.user_metadata?.full_name || user?.email?.split("@")[0]}</strong>
            <span className="block truncate text-xs font-semibold text-black/45">{user?.email}</span>
          </span>
        </span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/70 text-black/55 hover:bg-blush hover:text-ember"
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-5 flex items-center gap-2 rounded-2xl border border-white/70 bg-white/58 px-3 py-2 shadow-sm backdrop-blur-xl focus-within:ring-2 focus-within:ring-ember/25">
        <Search className="h-4 w-4 text-black/40" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full bg-transparent text-sm outline-none"
          placeholder="Search boards"
        />
      </div>

      <nav className="space-y-2" aria-label="Workspace navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-bold transition ${
                active ? "bg-ink text-white shadow-soft hover:-translate-y-0.5" : "text-black/55 hover:bg-white/55"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-white" : item.color}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="my-5 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />

      <div className="mb-3 flex items-center justify-between px-2">
        <p className="text-xs font-black uppercase text-black/42">Boards</p>
        <GalleryVerticalEnd className="h-4 w-4 text-black/35" />
      </div>

      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" aria-label="Boards">
        {visibleBoards.map((board) => (
          <button
            key={board.id}
            onClick={() => {
              onSelectBoard(board.id);
              onViewChange("organizer");
            }}
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
        {!visibleBoards.length ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white/45 px-4 py-5 text-center text-sm font-bold text-black/45">
            No boards match this search.
          </div>
        ) : null}
      </nav>

      <div className="shrink-0 pt-4">
        <button
          onClick={onCreateBoard}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-ember/40 bg-white/70 px-4 py-3 font-black text-ember shadow-sm backdrop-blur-xl hover:-translate-y-0.5 hover:bg-blush"
        >
          <Plus className="h-4 w-4" />
          New board
        </button>

        <div className="ai-gradient mt-4 rounded-3xl p-4 text-white shadow-soft">
          <Sparkles className="mb-3 h-5 w-5 text-marigold" />
          <p className="text-sm font-bold leading-6 text-white/82">
            Manual corrections are saved as learning signals, so similar pins lean toward the boards you actually choose.
          </p>
        </div>
      </div>
    </aside>
  );
}
