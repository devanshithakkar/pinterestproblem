import { CheckCircle2, ExternalLink, Loader2, Search, Sparkles, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import ConfidenceBadge from "./ConfidenceBadge";

export default function ExploreLibrary({ boards, onSaved, onBoardCreated }) {
  const [query, setQuery] = useState("desk setup");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [images, setImages] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [decisionState, setDecisionState] = useState(null);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const requestRef = useRef(0);

  const selectedBoardName = useMemo(
    () => boards.find((board) => board.id === selectedBoardId)?.name || "selected board",
    [boards, selectedBoardId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim() || "creative inspiration"), 450);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    loadImages({ nextPage: 1, replace: true });
  }, [debouncedQuery]);

  async function loadImages({ nextPage, replace }) {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setError("");
    replace ? setLoading(true) : setLoadingMore(true);
    try {
      const data = await api.searchLibrary({ query: debouncedQuery, page: nextPage });
      if (requestId !== requestRef.current) return;
      setImages((current) => (replace ? data.images : [...current, ...data.images]));
      setPagination(data.pagination);
      setPage(data.pagination?.page || nextPage);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err.message || "Unable to search the image library.");
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  function normalizeDecision(result, image) {
    const analysis = result.analysis || {};
    const decision = result.decision || {};
    return {
      image,
      action: result.action || decision.action,
      analysis,
      decision,
      predictedBoard: result.predictedBoard || decision.predictedBoard || null,
      suggestedBoard: result.suggestedBoard || {
        name: result.suggestedBoardName || decision.suggestedBoardName,
        description: result.suggestedBoardDescription || decision.suggestedBoardDescription,
      },
      confirmation: result.confirmation || null,
    };
  }

  async function smartSaveImage(image) {
    if (savingId) return;
    setSavingId(image.id);
    setDecisionState(null);
    setError("");
    try {
      const result = await api.aiAutoSave({
        imageUrl: image.imageUrl,
        fileName: `${image.provider}-${image.id}.jpg`,
        title: image.title,
        description: image.description,
        source: image.provider,
        height: image.height,
      });
      const nextDecision = normalizeDecision(result, image);
      setDecisionState(nextDecision);
      setSelectedBoardId(result.confirmation?.boardId || nextDecision.predictedBoard?.id || boards[0]?.id || "");

      if (result.action === "auto_save" && result.pin) {
        await onSaved(result.pin.boardId, result.pin);
      }
    } catch (err) {
      setError(err.message || "Unable to Smart Save this image.");
    } finally {
      setSavingId("");
    }
  }

  async function confirmSave(boardId = selectedBoardId) {
    if (!decisionState || !boardId) return;
    setSavingId(decisionState.image.id);
    setError("");
    try {
      const payload = decisionState.confirmation?.savePayload || {
        imageUrl: decisionState.image.imageUrl,
        fileName: `${decisionState.image.provider}-${decisionState.image.id}.jpg`,
        source: decisionState.image.provider,
        height: decisionState.image.height,
      };
      const { pin } = await api.aiConfirmSave({
        ...payload,
        selectedBoardId: boardId,
        analysis: decisionState.analysis,
        decision: decisionState.decision,
      });
      await onSaved(boardId, pin);
      setDecisionState({ ...decisionState, action: "saved", savedMessage: `Saved to ${selectedBoardName}.` });
    } catch (err) {
      setError(err.message || "Unable to save this image.");
    } finally {
      setSavingId("");
    }
  }

  async function createBoardAndSave() {
    if (!decisionState?.suggestedBoard?.name) return;
    setSavingId(decisionState.image.id);
    setError("");
    try {
      const { board, pin } = await api.aiCreateBoardAndSave({
        imageUrl: decisionState.image.imageUrl,
        fileName: `${decisionState.image.provider}-${decisionState.image.id}.jpg`,
        source: decisionState.image.provider,
        boardName: decisionState.suggestedBoard.name,
        boardDescription: decisionState.suggestedBoard.description,
        analysis: decisionState.analysis,
        decision: decisionState.decision,
      });
      await onBoardCreated?.(board);
      await onSaved(board.id, pin);
      setDecisionState({ ...decisionState, action: "saved", savedMessage: `Created ${board.name} and saved the image.` });
    } catch (err) {
      setError(err.message || "Unable to create the suggested board.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="space-y-5">
      <div className="glass-panel p-5">
        <p className="text-sm font-black uppercase text-ember">Explore library</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="max-w-2xl text-3xl font-black">Search visual inspiration and Smart Save without manual sorting.</h2>
          <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-3 py-2 shadow-sm lg:w-96">
            <Search className="h-4 w-4 text-black/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-sm font-semibold outline-none"
              placeholder="Search Pexels..."
            />
          </div>
        </div>
      </div>

      {error ? <div className="rounded-2xl bg-blush px-4 py-3 text-sm font-bold text-ember">{error}</div> : null}

      {decisionState ? (
        <div className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-ember">
                {decisionState.action === "auto_save"
                  ? "Auto-saved"
                  : decisionState.action === "confirm"
                    ? "Confirm Smart Save"
                    : decisionState.action === "saved"
                      ? "Saved"
                      : "New board suggested"}
              </p>
              <h3 className="mt-1 text-xl font-black">
                {decisionState.savedMessage || decisionState.predictedBoard?.name || decisionState.suggestedBoard?.name || decisionState.analysis.title}
              </h3>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-black/55">
                {decisionState.decision?.reasoning || decisionState.analysis?.description}
              </p>
            </div>
            <ConfidenceBadge score={decisionState.decision?.confidencePercent} />
          </div>

          {decisionState.action === "confirm" ? (
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <select
                value={selectedBoardId}
                onChange={(event) => setSelectedBoardId(event.target.value)}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-ember"
              >
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => confirmSave()}
                disabled={Boolean(savingId) || !selectedBoardId}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ember px-5 py-3 font-black text-white shadow-lift disabled:opacity-45"
              >
                <Upload className="h-4 w-4" />
                Save to Suggested Board
              </button>
            </div>
          ) : null}

          {decisionState.action === "suggest_new_board" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={createBoardAndSave}
                disabled={Boolean(savingId)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ember px-5 py-3 font-black text-white shadow-lift disabled:opacity-45"
              >
                <Sparkles className="h-4 w-4" />
                Create Board & Save
              </button>
              <select
                value={selectedBoardId}
                onChange={(event) => setSelectedBoardId(event.target.value)}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-ember"
              >
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => confirmSave(selectedBoardId)}
                disabled={Boolean(savingId) || !selectedBoardId}
                className="rounded-2xl bg-ink px-5 py-3 font-black text-white disabled:opacity-45"
              >
                Save to Existing Board
              </button>
            </div>
          ) : null}

          {decisionState.action === "auto_save" || decisionState.action === "saved" ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-moss px-4 py-3 text-sm font-black text-white">
              <CheckCircle2 className="h-4 w-4" />
              {decisionState.savedMessage || "Saved by Smart Save."}
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
          {Array.from({ length: 12 }, (_, index) => (
            <div key={index} className="mb-4 h-72 break-inside-avoid rounded-[1.5rem] bg-white/65 shadow-sm ring-1 ring-white/70">
              <div className="h-full animate-pulse rounded-[1.5rem] bg-black/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
          {images.map((image) => (
            <article key={`${image.provider}-${image.id}`} className="mb-4 break-inside-avoid overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-black/5">
              <img
                src={image.thumbnailUrl}
                alt={image.title}
                loading="lazy"
                className="w-full bg-blush object-cover"
                style={{ aspectRatio: `${image.width || 4} / ${image.height || 5}` }}
              />
              <div className="space-y-3 p-4">
                <div>
                  <h3 className="line-clamp-2 font-black">{image.title}</h3>
                  <p className="mt-1 text-xs font-bold text-black/45">by {image.authorName || image.provider}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => smartSaveImage(image)}
                    disabled={Boolean(savingId)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ink px-3 py-2.5 text-sm font-black text-white disabled:opacity-45"
                  >
                    {savingId === image.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Smart Save
                  </button>
                  <a
                    href={image.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="grid h-10 w-10 place-items-center rounded-2xl bg-blush text-ember"
                    aria-label={`Open ${image.provider} source`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && !images.length ? (
        <div className="rounded-[2rem] border border-dashed border-black/15 bg-white p-10 text-center">
          <p className="text-lg font-black">No images found</p>
          <p className="mt-2 text-sm font-semibold text-black/50">Try a broader search like workspace, recipes, outfits, or room decor.</p>
        </div>
      ) : null}

      {pagination?.hasMore ? (
        <div className="flex justify-center">
          <button
            onClick={() => loadImages({ nextPage: page + 1, replace: false })}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black shadow-sm ring-1 ring-black/10 disabled:opacity-45"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Load More
          </button>
        </div>
      ) : null}
    </section>
  );
}
