import { ArrowUpRight, Images, Sparkles } from "lucide-react";

export default function BoardCardGrid({ boards, activeBoardId, onSelectBoard }) {
  if (!boards.length) {
    return (
      <section className="mb-7 rounded-[2rem] border border-dashed border-black/15 bg-white p-10 text-center">
        <p className="text-lg font-black">No boards yet</p>
        <p className="mt-2 text-sm font-semibold text-black/50">
          Start by exploring images and Smart Saving your first idea.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-7">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-ember">Board studio</p>
          <h2 className="text-2xl font-black tracking-normal">Your AI-curated spaces</h2>
        </div>
        <span className="hidden rounded-full border border-white/70 bg-white/50 px-4 py-2 text-sm font-black text-black/55 shadow-sm backdrop-blur-xl sm:inline-flex">
          {boards.length} boards
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {boards.map((board, index) => (
          <button
            key={board.id}
            onClick={() => onSelectBoard(board.id)}
            className={`glass-panel group relative overflow-hidden p-4 text-left transition duration-300 hover:-translate-y-1 hover:shadow-lift ${
              activeBoardId === board.id ? "ring-2 ring-ember/45" : ""
            }`}
          >
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-ember/10 blur-2xl transition group-hover:bg-ember/20" />
            <div className="relative grid h-44 grid-cols-2 gap-2">
              {(board.previews.length ? board.previews : ["", "", "", ""]).slice(0, 4).map((src, imageIndex) =>
                src ? (
                  <img
                    key={src}
                    src={src}
                    alt=""
                    loading="lazy"
                    className={`h-full w-full rounded-2xl object-cover shadow-sm transition duration-500 group-hover:scale-[1.03] ${
                      imageIndex === 0 ? "row-span-2" : ""
                    }`}
                  />
                ) : (
                  <span key={imageIndex} className="grid h-full place-items-center rounded-2xl bg-white/55 text-black/30">
                    <Images className="h-5 w-5" />
                  </span>
                ),
              )}
            </div>
            <div className="relative mt-4 flex items-end justify-between gap-3">
              <span>
                <strong className="block text-lg font-black">{board.name}</strong>
                <span className="mt-1 line-clamp-2 block text-sm font-semibold leading-5 text-black/52">
                  {board.description}
                </span>
              </span>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white transition group-hover:rotate-12 group-hover:bg-ember">
                {activeBoardId === board.id ? <Sparkles className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              </span>
            </div>
            <div className="relative mt-4 flex items-center justify-between text-xs font-black text-black/45">
              <span>{board.pinCount} pins</span>
              <span className={board.visibility === "public" ? "text-moss" : "text-black/40"}>
                {board.visibility === "public" ? "Public" : "Private"} · AI #{index + 1}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
