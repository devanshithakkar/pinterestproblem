import { X } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";

export default function CreateBoardModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", description: "", tags: "", visibility: "private" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Board name is required.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const { board } = await api.createBoard({
        name: form.name,
        description: form.description,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
        visibility: form.visibility,
      });
      await onCreated(board);
      onClose();
    } catch (err) {
      setError(err.message || "Unable to create this board.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
      <form onSubmit={handleSubmit} className="max-h-[100dvh] w-full max-w-lg overflow-y-auto rounded-t-[1.6rem] bg-white p-5 shadow-soft sm:rounded-[2rem] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase text-ember">New board</p>
            <h2 className="text-2xl font-black">Create a smart board</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-black/[0.04]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-black">
            Board name
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
              placeholder="Travel, Fitness, UI Design..."
            />
          </label>
          <label className="block text-sm font-black">
            Description
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="mt-2 min-h-24 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
              placeholder="What belongs on this board?"
            />
          </label>
          <label className="block text-sm font-black">
            AI tags
            <input
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
              placeholder="minimal, travel, beach, map"
            />
          </label>
          <div className="rounded-2xl border border-black/10 bg-black/[0.025] p-3">
            <p className="mb-2 text-sm font-black">Visibility</p>
            <div className="grid grid-cols-2 gap-2">
              {["private", "public"].map((visibility) => (
                <button
                  key={visibility}
                  type="button"
                  onClick={() => setForm({ ...form, visibility })}
                  className={`rounded-2xl px-4 py-3 text-sm font-black ${
                    form.visibility === visibility ? "bg-ink text-white" : "bg-white text-black/55"
                  }`}
                >
                  {visibility}
                </button>
              ))}
            </div>
          </div>
        </div>
        {error ? <div className="mt-4 rounded-2xl bg-blush px-4 py-3 text-sm font-bold text-ember">{error}</div> : null}
        <button disabled={saving} className="mt-6 w-full rounded-2xl bg-ember px-5 py-3 font-black text-white shadow-lift disabled:opacity-60">
          {saving ? "Creating..." : "Create board"}
        </button>
      </form>
    </div>
  );
}
