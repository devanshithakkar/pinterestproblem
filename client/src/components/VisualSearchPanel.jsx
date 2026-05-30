import { Loader2, Search, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import PinCard from "./PinCard";
import { Button, EmptyState, FieldShell } from "./ui";

export default function VisualSearchPanel({ boards, onPreviewPin }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setPagination(null);
      setError("");
      return;
    }
    search({ page: 1, replace: true });
  }, [debouncedQuery]);

  async function search({ page, replace }) {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError("");
    try {
      const data = await api.searchPins({ query: debouncedQuery, page, limit: 24 });
      if (requestId !== requestRef.current) return;
      setResults((current) => (replace ? data.pins : [...current, ...data.pins]));
      setPagination(data.pagination);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err.message || "Unable to search your visual memory.");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="glass-panel p-5">
        <p className="text-sm font-black uppercase text-ember">AI visual search</p>
        <h2 className="mt-2 text-3xl font-black">Search your saved images naturally.</h2>
        <FieldShell className="mt-4">
          <Search className="h-5 w-5 text-black/40" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try: dark anime red lighting, campus friends, coding setup..."
            className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
          />
          {loading ? <Loader2 className="h-5 w-5 animate-spin text-ember" /> : null}
        </FieldShell>
      </div>

      {error ? <div className="rounded-2xl bg-blush px-4 py-3 text-sm font-bold text-ember">{error}</div> : null}

      {!debouncedQuery ? (
        <EmptyState icon={Sparkles} title="Your visual memory is ready" description="Search saved pins by subject, mood, color, board, or style." />
      ) : !loading && !results.length ? (
        <EmptyState title="No matching pins yet" description="Try a broader phrase or Smart Save more images." />
      ) : (
        <>
          <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
            {results.map((pin) => (
              <PinCard
                key={pin.id}
                pin={pin}
                boards={boards}
                onPreviewPin={onPreviewPin}
                readonly
              />
            ))}
          </div>
          {pagination?.hasMore ? (
            <Button
              type="button"
              onClick={() => search({ page: (pagination.page || 1) + 1, replace: false })}
              disabled={loading}
              className="w-full"
              variant="dark"
              loading={loading}
            >
              Load more results
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
