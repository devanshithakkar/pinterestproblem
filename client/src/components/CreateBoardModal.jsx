import { X } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";

export default function CreateBoardModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", description: "", tags: "" });
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-soft">
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
        </div>
        {error ? <div className="mt-4 rounded-2xl bg-blush px-4 py-3 text-sm font-bold text-ember">{error}</div> : null}
        <button disabled={saving} className="mt-6 w-full rounded-2xl bg-ember px-5 py-3 font-black text-white shadow-lift disabled:opacity-60">
          {saving ? "Creating..." : "Create board"}
        </button>
      </form>
    </div>
  );
}
