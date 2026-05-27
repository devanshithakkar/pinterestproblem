import { ImagePlus, Loader2, Sparkles, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
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

export default function UploadModal({ boards, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [prediction, setPrediction] = useState(null);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [busy, setBusy] = useState(false);

  const predictedBoard = useMemo(
    () => boards.find((board) => board.id === prediction?.predictedBoardId),
    [boards, prediction],
  );

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        imageUrl: reader.result,
        fileName: file.name,
        source: "Local upload",
        title: current.title || file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      }));
      setPrediction(null);
    };
    reader.readAsDataURL(file);
  }

  function useQuickSave(item) {
    setForm(item);
    setPrediction(null);
    setSelectedBoardId("");
  }

  async function predict() {
    setBusy(true);
    const { prediction: nextPrediction } = await api.predict(form);
    setPrediction(nextPrediction);
    setSelectedBoardId(nextPrediction.predictedBoardId);
    setBusy(false);
  }

  async function save() {
    setBusy(true);
    await api.savePin({
      ...form,
      boardId: selectedBoardId,
      ai: prediction,
      height: Number(form.height) || 580,
    });
    await onSaved(selectedBoardId);
    setBusy(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-[2rem] bg-white p-5 shadow-soft md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase text-ember">Save with AI</p>
            <h2 className="text-2xl font-black">Upload or quick-save inspiration</h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-black/[0.04]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-4">
            <label className="grid min-h-64 cursor-pointer place-items-center rounded-[1.6rem] border border-dashed border-ember/35 bg-blush p-4 text-center">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="Preview" className="max-h-72 rounded-[1.2rem] object-cover shadow-soft" />
              ) : (
                <span>
                  <ImagePlus className="mx-auto mb-3 h-9 w-9 text-ember" />
                  <strong className="block">Choose an image</strong>
                  <span className="mt-1 block text-sm font-semibold text-black/50">Local files are stored as prototype previews.</span>
                </span>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </label>

            <div>
              <p className="mb-2 text-sm font-black">Try a quick save</p>
              <div className="grid grid-cols-3 gap-2">
                {quickSaves.map((item) => (
                  <button key={item.title} onClick={() => useQuickSave(item)} className="overflow-hidden rounded-2xl ring-1 ring-black/5 transition hover:scale-[1.02]">
                    <img src={item.imageUrl} alt={item.title} className="h-24 w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <label className="block text-sm font-black">
              Title
              <input
                value={form.title}
                onChange={(event) => {
                  setForm({ ...form, title: event.target.value });
                  setPrediction(null);
                }}
                className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
                placeholder="Cozy workspace, outfit idea..."
              />
            </label>
            <label className="block text-sm font-black">
              Caption
              <textarea
                value={form.caption}
                onChange={(event) => {
                  setForm({ ...form, caption: event.target.value });
                  setPrediction(null);
                }}
                className="mt-2 min-h-24 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
                placeholder="Describe what is in the image and the mood you want to save."
              />
            </label>
            <label className="block text-sm font-black">
              Image tags
              <input
                value={form.tags}
                onChange={(event) => {
                  setForm({ ...form, tags: event.target.value });
                  setPrediction(null);
                }}
                className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
                placeholder="coding, laptop, dashboard"
              />
              <span className="mt-1 block text-xs font-semibold text-black/45">
                The simple AI compares these tags with each board's keywords.
              </span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-black">
                Image URL
                <input
                  value={form.imageUrl}
                  onChange={(event) => {
                    setForm({ ...form, imageUrl: event.target.value, source: "Image URL" });
                    setPrediction(null);
                  }}
                  className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
                  placeholder="https://..."
                />
              </label>
              <label className="block text-sm font-black">
                Color hint
                <input
                  value={form.dominantColor}
                  onChange={(event) => {
                    setForm({ ...form, dominantColor: event.target.value });
                    setPrediction(null);
                  }}
                  className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
                  placeholder="red, green, black..."
                />
              </label>
            </div>

            {prediction ? (
              <div className="rounded-[1.5rem] bg-[#fff8f5] p-4 ring-1 ring-ember/15">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase text-ember">Prediction</p>
                    <h3 className="text-xl font-black">{predictedBoard?.name || prediction.predictedBoardName}</h3>
                  </div>
                  <ConfidenceBadge score={prediction.confidence} />
                </div>
                <p className="text-sm font-semibold leading-6 text-black/55">{prediction.explanation}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {prediction.signals.map((signal) => (
                    <span key={signal} className="rounded-full bg-white px-3 py-1 text-xs font-black text-black/55">
                      {signal}
                    </span>
                  ))}
                </div>
                {prediction.scores?.length ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-black uppercase text-black/45">Board similarity scores</p>
                    {prediction.scores.map((item) => (
                      <div key={item.boardId} className="grid grid-cols-[88px_1fr_38px] items-center gap-2 text-xs font-black text-black/55">
                        <span className="truncate">{item.boardName}</span>
                        <span className="h-2 overflow-hidden rounded-full bg-black/10">
                          <span
                            className="block h-full rounded-full bg-ember"
                            style={{ width: `${Math.min(100, item.score * 4)}%` }}
                          />
                        </span>
                        <span className="text-right">{item.score}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <label className="mt-4 block text-sm font-black">
                  Correct board before saving
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
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={predict}
                disabled={busy || !form.imageUrl || !form.caption}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3 font-black text-white disabled:opacity-45"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Predict board
              </button>
              <button
                onClick={save}
                disabled={busy || !prediction || !selectedBoardId}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ember px-5 py-3 font-black text-white shadow-lift disabled:opacity-45"
              >
                <Upload className="h-4 w-4" />
                Save pin
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
