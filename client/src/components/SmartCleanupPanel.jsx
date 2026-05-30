import { Loader2, Merge, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function SmartCleanupPanel({ onMerged }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mergingId, setMergingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingSuggestion, setPendingSuggestion] = useState(null);

  async function load({ keepSuccess = false } = {}) {
    setLoading(true);
    setError("");
    if (!keepSuccess) setSuccess("");
    try {
      const data = await api.getBoardCleanupSuggestions();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err.message || "Unable to load cleanup suggestions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function mergeSuggestion(suggestion = pendingSuggestion) {
    if (!suggestion) return;
    setMergingId(suggestion.sourceBoard.id);
    setError("");
    setSuccess("");
    try {
      const result = await api.mergeBoards({ sourceBoardId: suggestion.sourceBoard.id, targetBoardId: suggestion.targetBoard.id });
      await onMerged?.(suggestion.targetBoard.id);
      setSuccess(result.message || `Merged "${suggestion.sourceBoard.name}" into "${suggestion.targetBoard.name}".`);
      setPendingSuggestion(null);
      await load({ keepSuccess: true });
    } catch (err) {
      setError(err.message || "Unable to merge these boards.");
    } finally {
      setMergingId("");
    }
  }

  return (
    <section className="glass-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase text-ember">Smart cleanup</p>
          <h2 className="mt-1 text-2xl font-black">Merge duplicate board ideas</h2>
        </div>
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-ember" /> : <Merge className="h-6 w-6 text-ember" />}
      </div>
      {error ? <p className="mt-4 rounded-2xl bg-blush px-4 py-3 text-sm font-bold text-ember">{error}</p> : null}
      {success ? <p className="mt-4 rounded-2xl bg-moss/10 px-4 py-3 text-sm font-bold text-moss">{success}</p> : null}
      <div className="mt-5 space-y-3">
        {!loading && !suggestions.length ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white/60 p-6 text-center">
            <Sparkles className="mx-auto h-5 w-5 text-ember" />
            <p className="mt-2 text-sm font-black">No merge suggestions right now</p>
          </div>
        ) : null}
        {suggestions.map((suggestion) => (
          <article key={`${suggestion.sourceBoard.id}-${suggestion.targetBoard.id}`} className="rounded-2xl bg-white/65 p-4 shadow-sm ring-1 ring-white/70">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-black">
                  {suggestion.sourceBoard.name} → {suggestion.targetBoard.name}
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-black/50">{suggestion.reason}</p>
                <p className="mt-2 text-xs font-black text-moss">{Math.round((suggestion.confidence || 0) * 100)}% match</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingSuggestion(suggestion)}
                disabled={Boolean(mergingId)}
                className="rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {mergingId === suggestion.sourceBoard.id ? "Merging..." : "Merge"}
              </button>
            </div>
          </article>
        ))}
      </div>
      {pendingSuggestion ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-5 shadow-soft">
            <p className="text-xs font-black uppercase text-ember">Confirm merge</p>
            <h3 className="mt-2 text-2xl font-black">
              Merge {pendingSuggestion.sourceBoard.name} into {pendingSuggestion.targetBoard.name}?
            </h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-black/55">
              Pins from the source board will move to the target board. PinMind will delete the source board only after it is empty.
            </p>
            <div className="mt-4 rounded-2xl bg-black/[0.03] p-4 text-sm font-bold text-black/55">
              {pendingSuggestion.reason}
              <span className="mt-2 block text-moss">{Math.round((pendingSuggestion.confidence || 0) * 100)}% match confidence</span>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingSuggestion(null)}
                disabled={Boolean(mergingId)}
                className="rounded-2xl bg-black/5 px-4 py-3 text-sm font-black text-black/55 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => mergeSuggestion()}
                disabled={Boolean(mergingId)}
                className="rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {mergingId ? "Merging..." : "Confirm Merge"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
