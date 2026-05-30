import { Loader2, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function BoardRecommendations({ boardId, onSaved, onBoardCreated }) {
  const [images, setImages] = useState([]);
  const [query, setQuery] = useState("");
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!boardId) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getBoardRecommendations({ boardId, provider: "all", page: 1 });
      setImages(data.images || []);
      setQuery(data.query || "");
      setQueries(data.queries || []);
    } catch (err) {
      setError(err.message || "Unable to load board recommendations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [boardId]);

  async function smartSave(image) {
    if (savingId) return;
    setSavingId(image.id);
    setMessage("");
    setError("");
    try {
      const result = await api.aiAutonomousSave({
        imageUrl: image.imageUrl,
        fileName: `${image.provider}-${image.id}.jpg`,
        title: image.title,
        description: image.description,
        tags: image.tags || [],
        providerTags: image.tags || [],
        source: `${image.provider} recommendation`,
        preferredBoardId: boardId,
        recommendedBoardId: boardId,
        height: image.height,
      });
      if (result.createdBoard) await onBoardCreated?.(result.createdBoard);
      if (result.createdPin || result.pin) {
        const pin = result.createdPin || result.pin;
        await onSaved?.(pin.boardId, pin);
      }
      setMessage(
        result.action === "created_new_board_and_saved"
          ? `Created ${(result.createdBoard || result.board)?.name || "a board"} and saved.`
          : `Saved to ${(result.matchedBoard || result.board)?.name || "the best board"}.`,
      );
    } catch (err) {
      setError(err.message || "Unable to Smart Save this recommendation.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="mt-8 glass-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase text-ember">More like this board</p>
          <h2 className="mt-1 text-2xl font-black">Recommended from this board’s profile</h2>
          {query ? <p className="mt-1 text-sm font-semibold text-black/45">Query: {query}</p> : null}
        </div>
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-ember" /> : <WandSparkles className="h-6 w-6 text-ember" />}
      </div>
      {error ? <p className="mt-4 rounded-2xl bg-blush px-4 py-3 text-sm font-bold text-ember">{error}</p> : null}
      {message ? <p className="mt-4 rounded-2xl bg-moss/10 px-4 py-3 text-sm font-bold text-moss">{message}</p> : null}
      {!loading && !error && !images.length ? (
        <div className="mt-5 rounded-2xl border border-dashed border-black/15 bg-white/60 p-6 text-center">
          <p className="text-sm font-black">No recommendations yet</p>
          <p className="mt-2 text-xs font-semibold text-black/45">Save a few more pins to sharpen this board’s profile.</p>
        </div>
      ) : null}
      {queries.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {queries.map((item) => (
            <span key={item} className="rounded-full bg-white/60 px-3 py-1.5 text-xs font-black text-black/45">
              {item}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {images.map((image) => (
          <article key={`${image.provider}-${image.id}`} className="overflow-hidden rounded-[1.5rem] bg-white/70 shadow-sm ring-1 ring-white/70">
            <img src={image.thumbnailUrl || image.imageUrl} alt={image.title} loading="lazy" className="h-52 w-full object-cover" />
            <div className="space-y-3 p-3">
              <h3 className="line-clamp-2 text-sm font-black">{image.title}</h3>
              <button
                type="button"
                onClick={() => smartSave(image)}
                disabled={Boolean(savingId)}
                className="w-full rounded-2xl bg-ember px-3 py-2.5 text-sm font-black text-white disabled:opacity-50"
              >
                {savingId === image.id ? "Saving..." : "Smart Save"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
