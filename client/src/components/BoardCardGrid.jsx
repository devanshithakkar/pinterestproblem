import { ArrowUpRight, Globe2, Images, Lock, Sparkles } from "lucide-react";
import { Badge, Button, EmptyState } from "./ui";

export default function BoardCardGrid({ boards, activeBoardId, onSelectBoard, onToggleVisibility, pendingVisibilityBoardId }) {
  if (!boards.length) {
    return (
      <section className="mb-7">
        <EmptyState title="No boards yet" description="Start by exploring images and Smart Saving your first idea." />
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
        <Badge className="hidden sm:inline-flex">
          {boards.length} boards
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {boards.map((board, index) => {
          const isPublic = board.visibility === "public";
          const VisibilityIcon = isPublic ? Globe2 : Lock;
          const pending = pendingVisibilityBoardId === board.id;
          return (
            <article
              key={board.id}
              className={`glass-panel group relative overflow-hidden p-4 text-left transition duration-300 hover:-translate-y-1 hover:shadow-lift ${
                activeBoardId === board.id ? "ring-2 ring-ember/45" : ""
              }`}
            >
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-ember/10 blur-2xl transition group-hover:bg-ember/20" />
              <button type="button" onClick={() => onSelectBoard(board.id)} className="relative block w-full text-left">
                <div className="grid h-44 grid-cols-2 gap-2 overflow-hidden rounded-[1.35rem] bg-white/45">
                  {(board.previews.length ? board.previews : ["", "", "", ""]).slice(0, 4).map((src, imageIndex) =>
                    src ? (
                      <img
                        key={src}
                        src={src}
                        alt=""
                        loading="lazy"
                        className={`h-full w-full object-cover shadow-sm transition duration-500 group-hover:scale-[1.03] ${
                          imageIndex === 0 ? "row-span-2" : ""
                        }`}
                      />
                    ) : (
                      <span key={imageIndex} className="grid h-full place-items-center bg-white/55 text-black/30">
                        <Images className="h-5 w-5" />
                      </span>
                    ),
                  )}
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
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
              </button>
              <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-black text-black/45">
                <Badge>{board.pinCount} pins</Badge>
                <Badge tone={isPublic ? "moss" : "neutral"}>
                  <VisibilityIcon className="h-3.5 w-3.5" />
                  {isPublic ? "Public" : "Private"} · AI #{index + 1}
                </Badge>
              </div>
              <Button
                type="button"
                onClick={() => onToggleVisibility?.(board)}
                disabled={pending}
                variant="ghost"
                className="relative mt-3 w-full"
                icon={VisibilityIcon}
              >
                {pending ? "Updating..." : isPublic ? "Make Private" : "Make Public"}
              </Button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
