import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function PinPreviewModal({ pin, boardName, onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!pin) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/82 p-3 backdrop-blur-xl animate-in fade-in duration-200 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${pin.title} preview`}
    >
      <div className="grid max-h-[94dvh] w-full max-w-6xl overflow-hidden rounded-[1.6rem] bg-white shadow-soft sm:rounded-[2rem] lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-h-[50dvh] items-center justify-center bg-black">
          <img src={pin.imageUrl} alt={pin.title} className="max-h-[72dvh] w-full object-contain" />
        </div>
        <aside className="max-h-[44dvh] overflow-y-auto p-5 lg:max-h-[94dvh]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-ember">{boardName || "Saved pin"}</p>
              <h2 className="mt-1 text-2xl font-black">{pin.title}</h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/[0.05] text-black/65 hover:bg-blush hover:text-ember"
              aria-label="Close image preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {pin.caption ? <p className="text-sm font-semibold leading-6 text-black/58">{pin.caption}</p> : null}
          {pin.tags?.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {pin.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-blush px-3 py-1.5 text-xs font-black text-black/58">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <dl className="mt-6 grid gap-3 text-sm">
            <div className="rounded-2xl bg-black/[0.03] p-3">
              <dt className="text-xs font-black uppercase text-black/38">Source</dt>
              <dd className="mt-1 font-bold text-black/65">{pin.source || "PinMind"}</dd>
            </div>
            <div className="rounded-2xl bg-black/[0.03] p-3">
              <dt className="text-xs font-black uppercase text-black/38">Saved</dt>
              <dd className="mt-1 font-bold text-black/65">
                {pin.createdAt ? new Date(pin.createdAt).toLocaleDateString() : "Recently"}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
