import { BrainCircuit, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function BoardIntelligencePanel({ boardId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .getBoardProfile(boardId)
      .then((data) => {
        if (!cancelled) setProfile(data.profile);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Unable to load board intelligence.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  return (
    <section className="glass-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase text-ember">Board intelligence</p>
          <h2 className="mt-1 text-2xl font-black">Visual identity profile</h2>
        </div>
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-ember" /> : <BrainCircuit className="h-6 w-6 text-ember" />}
      </div>

      {error ? <p className="mt-4 rounded-2xl bg-blush px-4 py-3 text-sm font-bold text-ember">{error}</p> : null}
      {profile ? (
        <div className="mt-5 space-y-4">
          <p className="text-sm font-semibold leading-6 text-black/58">{profile.summary}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Top tags", profile.topTags],
              ["Categories", profile.dominantCategories],
              ["Subjects", profile.subjects],
              ["Moods", profile.moods],
              ["Styles", profile.styles],
              ["Colors", profile.colors],
            ].map(([label, values]) => (
              <div key={label} className="rounded-2xl bg-white/60 p-3 shadow-sm ring-1 ring-white/70">
                <p className="text-xs font-black uppercase text-black/40">{label}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {values?.length ? (
                    values.map((value) => (
                      <span key={value} className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-black/55 shadow-sm">
                        {value}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-bold text-black/35">Learning</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-ink p-4 text-white">
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase text-white/60">
              <Sparkles className="h-3.5 w-3.5" />
              Recommendation queries
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.recommendationQueries?.map((query) => (
                <span key={query} className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-black text-white/85">
                  {query}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : !loading ? (
        <p className="mt-4 text-sm font-semibold text-black/50">Save pins to this board to build its profile.</p>
      ) : null}
    </section>
  );
}
