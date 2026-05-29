import { CheckCircle2, ImagePlus, Loader2, Sparkles, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { quickSaves } from "../data/sampleImages";
import ConfidenceBadge from "./ConfidenceBadge";

const emptyForm = {
  title: "",
  caption: "",
  tags: "",
  imageUrl: "",
  fileName: "",
  dominantColor: "",
  source: "Upload",
  height: 580,
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const smartSaveSteps = ["Preparing", "Uploading", "Analyzing", "Matching", "Saving", "Done"];

async function compressImageFile(file) {
  if (!file || !file.type.startsWith("image/")) return file;
  if (file.size < 1_500_000) return file;

  try {
    const image = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    if (scale >= 1) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, file.type === "image/png" ? "image/png" : "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    const extension = file.type === "image/png" ? "png" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "pinmind-upload";
    return new File([blob], `${baseName}-optimized.${extension}`, { type: blob.type || file.type });
  } catch (error) {
    console.warn("Image compression skipped.", error);
    return file;
  }
}

export default function UploadModal({ boards, onClose, onSaved, onBoardCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [visionAnalysis, setVisionAnalysis] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [suggestedBoard, setSuggestedBoard] = useState(null);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [showExistingBoardChoice, setShowExistingBoardChoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [stepIndex, setStepIndex] = useState(-1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const requestRef = useRef(0);

  const predictedBoard = useMemo(
    () => boards.find((board) => board.id === aiResult?.predictedBoard?.id) || aiResult?.predictedBoard,
    [boards, aiResult],
  );

  function applyAiResult(result) {
    const analysis = result.analysis || {};
    const decision = result.decision || result.prediction || {};
    const nextAiResult = {
      ...decision,
      action: result.action || decision.action,
      detectedTags: analysis.detectedTags || decision.detectedTags || [],
      suggestedTitle: analysis.title || decision.suggestedTitle,
      suggestedCaption: analysis.description || decision.suggestedCaption,
      reasoning: decision.reasoning || analysis.reasoning,
      confidence: result.confidence ?? decision.confidence,
    };
    setVisionAnalysis(analysis);
    setAiResult(nextAiResult);
    setConfirmation(result.confirmation || null);
    setSuggestedBoard(result.suggestedBoard || {
      name: result.suggestedBoardName,
      description: result.suggestedBoardDescription,
      tags: analysis.detectedTags?.slice(0, 8) || [],
    });
    setSelectedBoardId(result.confirmation?.boardId || decision.predictedBoard?.id || result.predictedBoard?.id || "");
    setShowExistingBoardChoice(false);
    return { analysis, decision: nextAiResult };
  }

  async function finishSmartSave(result) {
    const { decision } = applyAiResult(result);
    const savedPin = result.createdPin || result.pin;
    const createdBoard = result.createdBoard || result.board;

    if (createdBoard) await onBoardCreated?.(createdBoard);
    if (result.action === "auto_save" && savedPin) {
      setStepIndex(4);
      await onSaved(savedPin.boardId, savedPin);
      setStepIndex(5);
      setSuccess(`Auto-saved to ${decision.predictedBoard?.name || result.predictedBoard?.name || "the best board"}.`);
    }
  }

  async function prepareFile(file) {
    if (!file) return;
    if (busy) return;
    if (!file.type?.startsWith("image/")) {
      setError("Choose a JPG, PNG, WebP, or other image file.");
      return;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setBusy(true);
    setBusyLabel("Preparing image");
    setStepIndex(0);
    setError("");
    setSuccess("");
    resetAiState();
    let stepTimer;
    try {
      const optimizedFile = await compressImageFile(file);
      if (optimizedFile.size > MAX_UPLOAD_BYTES) {
        throw new Error("Image is still larger than 8MB after compression. Try a smaller file.");
      }
      if (requestId !== requestRef.current) return;
      setBusyLabel("Uploading");
      setStepIndex(1);
      setForm((current) => ({
        ...current,
        imageUrl: URL.createObjectURL(optimizedFile),
        fileName: optimizedFile.name,
        source: "Local upload",
      }));
      stepTimer = window.setInterval(() => {
        setStepIndex((current) => (current >= 1 && current < 3 ? current + 1 : current));
        setBusyLabel((current) => (current === "Uploading" ? "Analyzing" : current === "Analyzing" ? "Matching board" : current));
      }, 1200);
      const result = await api.smartSaveUpload(optimizedFile);
      window.clearInterval(stepTimer);
      if (requestId !== requestRef.current) return;
      const upload = result.image || {};
      setForm((current) => ({
        ...current,
        imageUrl: upload.imageUrl || current.imageUrl,
        fileName: optimizedFile.name,
        mimeType: upload.mimeType || optimizedFile.type,
        storagePath: upload.storagePath,
        source: "Supabase Storage upload",
        height: 580,
      }));
      if (result.action === "auto_save") setBusyLabel("Saving");
      await finishSmartSave(result);
      if (result.action === "confirm") {
        setStepIndex(3);
        setSuccess("");
      }
      if (result.action === "suggest_new_board") {
        setStepIndex(3);
        setSuccess("");
      }
    } catch (err) {
      setError(err.message || "Unable to smart-save that image.");
    } finally {
      if (stepTimer) window.clearInterval(stepTimer);
      setBusy(false);
      setBusyLabel("");
    }
  }

  function resetAiState() {
    setVisionAnalysis(null);
    setAiResult(null);
    setConfirmation(null);
    setSuggestedBoard(null);
    setSelectedBoardId("");
    setShowExistingBoardChoice(false);
    setSuccess("");
  }

  function handleDrop(event) {
    event.preventDefault();
    prepareFile(event.dataTransfer.files?.[0]);
  }

  function useQuickSave(item) {
    setForm(item);
    setError("");
    resetAiState();
    organizeWithAi(item);
  }

  async function organizeWithAi(nextForm = form) {
    if (!nextForm.imageUrl) {
      setError("Choose an image or paste an image URL first.");
      return;
    }
    if (busy) return;

    setBusy(true);
    setBusyLabel("Analyzing");
    setStepIndex(2);
    setError("");
    setSuccess("");
    try {
      const result = await api.aiAutoSave({
        imageUrl: nextForm.imageUrl,
        fileName: nextForm.fileName,
        mimeType: nextForm.mimeType,
        source: nextForm.source,
        height: nextForm.height,
      });
      setStepIndex(3);
      const { decision } = applyAiResult(result);

      if (result.action === "auto_save" && result.pin) {
        setStepIndex(4);
        await onSaved(result.pin.boardId, result.pin);
        setStepIndex(5);
        setSuccess(`Auto-saved to ${decision.predictedBoard.name}.`);
      }
    } catch (err) {
      setError(err.message || "Unable to organize this image.");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function confirmSave(boardId = selectedBoardId) {
    if (!boardId) {
      setError("Choose a board before saving.");
      return;
    }

    setBusy(true);
    setBusyLabel("Saving pin");
    setStepIndex(4);
    setError("");
    try {
      const payload = confirmation?.savePayload || {
        imageUrl: form.imageUrl,
        fileName: form.fileName,
        source: form.source,
      };
      const { pin } = await api.aiConfirmSave({
        ...payload,
        selectedBoardId: boardId,
        analysis: visionAnalysis,
        decision: aiResult,
        boardKeywords: suggestedBoard.tags || aiResult.suggestedKeywords || visionAnalysis?.detectedTags || [],
      });
      await onSaved(boardId, pin);
      setStepIndex(5);
      setSuccess(`Saved to ${boards.find((board) => board.id === boardId)?.name || "board"}.`);
    } catch (err) {
      setError(err.message || "Unable to save this pin.");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function createSuggestedBoardAndSave() {
    if (!suggestedBoard?.name) return;

    setBusy(true);
    setBusyLabel("Creating board");
    setStepIndex(4);
    setError("");
    try {
      const { board, pin } = await api.aiCreateBoardAndSave({
        imageUrl: form.imageUrl,
        fileName: form.fileName,
        source: form.source,
        boardName: suggestedBoard.name,
        boardDescription: suggestedBoard.description,
        analysis: visionAnalysis,
        decision: aiResult,
      });
      await onBoardCreated?.(board);
      await onSaved(board.id, pin);
      setSelectedBoardId(board.id);
      setStepIndex(5);
      setSuccess(`Created ${board.name} and saved the image there.`);
    } catch (err) {
      setError(err.message || "Unable to create the suggested board.");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-black/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
      <div className="max-h-[100dvh] w-full overflow-y-auto rounded-t-[1.6rem] bg-white p-4 shadow-soft sm:max-w-5xl sm:rounded-[2rem] sm:p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase text-ember">AI smart save</p>
            <h2 className="text-xl font-black sm:text-2xl">Drop an image and let PinMind organize it</h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-black/[0.04]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="space-y-4">
            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className={`grid min-h-56 place-items-center rounded-[1.6rem] border border-dashed border-ember/35 bg-blush p-4 text-center transition hover:border-ember sm:min-h-72 ${
                busy ? "cursor-wait opacity-80" : "cursor-pointer"
              }`}
            >
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="Preview" loading="lazy" className="max-h-72 rounded-[1.2rem] object-cover shadow-soft sm:max-h-80" />
              ) : (
                <span>
                  <ImagePlus className="mx-auto mb-3 h-10 w-10 text-ember" />
                  <strong className="block">Drag, drop, or choose an image</strong>
                  <span className="mt-1 block text-sm font-semibold text-black/50">
                    Upload once. PinMind stores it, analyzes it visually, and chooses the right next step.
                  </span>
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(event) => prepareFile(event.target.files?.[0])}
              />
            </label>

            <label className="block text-sm font-black">
              Image URL <span className="font-semibold text-black/40">(optional quick test)</span>
              <input
                value={form.imageUrl.startsWith("data:") ? "" : form.imageUrl}
                onChange={(event) => {
                  setForm({ ...form, imageUrl: event.target.value, source: "Image URL" });
                  resetAiState();
                }}
                onBlur={() => {
                  if (form.imageUrl && !busy && !aiResult) organizeWithAi();
                }}
                disabled={busy}
                className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
                placeholder="https://..."
              />
            </label>

            <div>
              <p className="mb-2 text-sm font-black">Try a quick save</p>
              <div className="grid grid-cols-3 gap-2">
                {quickSaves.map((item) => (
                  <button
                    key={item.title}
                    onClick={() => useQuickSave(item)}
                    disabled={busy}
                    className="overflow-hidden rounded-2xl ring-1 ring-black/5 transition hover:scale-[1.02] disabled:opacity-50"
                  >
                    <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-24 w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-[1.5rem] bg-[#fff8f5] p-4 ring-1 ring-ember/15">
              <p className="text-xs font-black uppercase text-ember">No manual tagging</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-black/55">
                Drop or choose an image and PinMind immediately uploads it, analyzes it, matches it to your boards, and saves or asks for confirmation.
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-ember">Automatic Smart Save</p>
                  <p className="mt-1 text-sm font-semibold text-black/55">
                    {busy ? `${busyLabel}...` : success ? "Smart Save complete." : "Select a file to start. No manual metadata required."}
                  </p>
                </div>
                {busy ? <Loader2 className="h-5 w-5 animate-spin text-ember" /> : <Sparkles className="h-5 w-5 text-ember" />}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-6">
                {smartSaveSteps.map((step, index) => (
                  <div
                    key={step}
                    className={`rounded-2xl px-3 py-2 text-center text-[11px] font-black ${
                      stepIndex >= index ? "bg-ember text-white" : "bg-blush text-black/45"
                    }`}
                  >
                    {step}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => organizeWithAi()}
                disabled={busy || !form.imageUrl}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              >
                Debug analyze
              </button>
            </div>

            {aiResult ? (
              <div className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase text-ember">
                      {aiResult.action === "auto_save" ? "Auto-saved" : aiResult.action === "confirm" ? "Confirm match" : "New board suggested"}
                    </p>
                    <h3 className="text-xl font-black">{predictedBoard?.name || aiResult.suggestedBoardName || "Fresh board"}</h3>
                  </div>
                  <ConfidenceBadge score={aiResult.confidencePercent} />
                </div>
                <p className="text-sm font-semibold leading-6 text-black/55">{aiResult.reasoning}</p>
                {visionAnalysis ? (
                  <div className="mt-3 rounded-2xl bg-[#fff8f5] p-3">
                    <p className="text-xs font-black uppercase text-ember">Generated analysis</p>
                    <h4 className="mt-1 font-black">{visionAnalysis.title}</h4>
                    <p className="mt-1 text-sm font-semibold leading-6 text-black/55">{visionAnalysis.description}</p>
                    <p className="mt-2 text-xs font-bold text-black/45">
                      {[visionAnalysis.primaryCategory || visionAnalysis.category, visionAnalysis.primarySubject, ...(visionAnalysis.style || []), ...(visionAnalysis.mood || [])]
                        .filter(Boolean)
                        .join(" / ")}
                    </p>
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {aiResult.detectedTags?.map((tag) => (
                    <span key={tag} className="rounded-full bg-blush px-3 py-1 text-xs font-black text-black/55">
                      {tag}
                    </span>
                  ))}
                </div>

                {aiResult.action === "confirm" ? (
                  <div className="mt-4 space-y-3">
                    <p className="rounded-2xl bg-blush px-4 py-3 text-sm font-bold text-ember">
                      PinMind is not fully certain. Save only after you confirm the board.
                    </p>
                    <label className="block text-sm font-black">
                      Save to board
                      <select
                        value={selectedBoardId}
                        onChange={(event) => setSelectedBoardId(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-ember"
                      >
                        {boards.map((board) => (
                          <option key={board.id} value={board.id}>
                            {board.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={() => confirmSave()}
                      disabled={busy || !selectedBoardId}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ember px-5 py-3 font-black text-white shadow-lift disabled:opacity-45"
                    >
                      <Upload className="h-4 w-4" />
                      Save to suggested board
                    </button>
                  </div>
                ) : null}

                {aiResult.action === "suggest_new_board" && suggestedBoard ? (
                  <div className="mt-4 rounded-2xl bg-blush p-4">
                    <p className="text-xs font-black uppercase text-ember">Suggested board</p>
                    <p className="mt-2 text-sm font-bold text-black/62">
                      This image does not strongly match your existing boards.
                    </p>
                    <h4 className="mt-1 text-lg font-black">{suggestedBoard.name}</h4>
                    <p className="mt-1 text-sm font-semibold text-black/55">{suggestedBoard.description}</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button
                        onClick={createSuggestedBoardAndSave}
                        disabled={busy}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ember px-5 py-3 font-black text-white shadow-lift disabled:opacity-45"
                      >
                        <Sparkles className="h-4 w-4" />
                        Create Board & Save
                      </button>
                      <button
                        onClick={() => {
                          setShowExistingBoardChoice(true);
                          setSelectedBoardId(boards[0]?.id || "");
                        }}
                        disabled={busy || !boards.length}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-ink shadow-sm ring-1 ring-black/10 disabled:opacity-45"
                      >
                        Choose Existing Board
                      </button>
                    </div>
                    {showExistingBoardChoice ? (
                      <div className="mt-3 space-y-3 rounded-2xl bg-white/70 p-3">
                        <label className="block text-sm font-black">
                          Existing board
                          <select
                            value={selectedBoardId}
                            onChange={(event) => setSelectedBoardId(event.target.value)}
                            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-ember"
                          >
                            {boards.map((board) => (
                              <option key={board.id} value={board.id}>
                                {board.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          onClick={() => confirmSave(selectedBoardId)}
                          disabled={busy || !selectedBoardId}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3 font-black text-white disabled:opacity-45"
                        >
                          <Upload className="h-4 w-4" />
                          Save to selected board
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {success ? (
              <div className="inline-flex w-full items-center gap-2 rounded-2xl bg-moss px-4 py-3 text-sm font-black text-white">
                <CheckCircle2 className="h-4 w-4" />
                {success}
              </div>
            ) : null}
            {error ? <div className="rounded-2xl bg-blush px-4 py-3 text-sm font-bold text-ember">{error}</div> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
