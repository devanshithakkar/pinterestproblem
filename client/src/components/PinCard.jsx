import { ArrowRightLeft, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import ConfidenceBadge from "./ConfidenceBadge";
import { Badge, Button } from "./ui";

export default function PinCard({
  pin,
  boards,
  onMovePin,
  onUpdatePin,
  onDeletePin,
  onPreviewPin,
  readonly = false,
}) {
  return (
    <article className="group mb-4 break-inside-avoid overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/68 shadow-sm backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <button
        type="button"
        onClick={() => onPreviewPin?.(pin)}
        className="relative block w-full overflow-hidden text-left"
        aria-label={`Preview ${pin.title}`}
      >
        <img
          src={pin.imageUrl}
          alt={pin.title}
          loading="lazy"
          className="w-full object-cover transition duration-500 group-hover:scale-105"
          style={{ height: `${Math.min(pin.height || 520, 760)}px` }}
        />
        <div className="absolute inset-x-3 top-3 flex justify-between gap-2 opacity-0 transition group-hover:opacity-100">
          {pin.ai?.confidence ? <ConfidenceBadge score={pin.ai.confidence} compact /> : null}
          {pin.correctedAt ? (
            <Badge tone="moss" className="bg-white/90">
              <CheckCircle2 className="h-3.5 w-3.5" />
              learned
            </Badge>
          ) : null}
        </div>
      </button>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-base font-black">{pin.title}</h3>
          <p className="mt-1 text-sm font-medium leading-6 text-black/58">{pin.caption}</p>
        </div>
        {pin.ai?.signals?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {pin.ai.signals.slice(0, 4).map((signal) => (
              <span key={signal} className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold text-black/55 shadow-sm">
                {signal}
              </span>
            ))}
          </div>
        ) : null}
        {!readonly ? (
          <>
            <label className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 text-sm font-bold text-black/55 shadow-sm ring-1 ring-white/70">
              <ArrowRightLeft className="h-4 w-4 text-ember" />
              <select
                value={pin.boardId}
                onChange={(event) => onMovePin?.(pin.id, event.target.value)}
                className="w-full bg-transparent font-bold outline-none"
                aria-label={`Move ${pin.title} to another board`}
              >
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                onClick={() => onUpdatePin?.(pin)}
                variant="ghost"
                icon={Pencil}
              >
                Edit
              </Button>
              <Button
                type="button"
                onClick={() => onDeletePin?.(pin)}
                variant="soft"
                icon={Trash2}
              >
                Delete
              </Button>
            </div>
          </>
        ) : pin.board?.name ? (
          <p className="rounded-2xl bg-white/70 px-3 py-2 text-xs font-black text-black/45 shadow-sm ring-1 ring-white/70">
            Board: {pin.board.name}
          </p>
        ) : null}
      </div>
    </article>
  );
}
