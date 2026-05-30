import { ArrowLeft, EyeOff, ExternalLink, Globe2, Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function PublicProfilePage({ username, onBack }) {
  const [data, setData] = useState(null);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [activeBoard, setActiveBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    api
      .getPublicUserBoards(username)
      .then((result) => {
        if (!mounted) return;
        setData(result);
        setActiveBoardId(result.boards?.[0]?.id || null);
      })
      .catch((err) => setError(err.message || "Unable to load this profile."))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [username]);

  useEffect(() => {
    if (!activeBoardId) {
      setActiveBoard(null);
      return;
    }
    let mounted = true;
    setLoadingBoard(true);
    api
      .getPublicUserBoard(username, activeBoardId)
      .then((result) => mounted && setActiveBoard(result))
      .catch((err) => setError(err.message || "Unable to load this board."))
      .finally(() => mounted && setLoadingBoard(false));
    return () => {
      mounted = false;
    };
  }, [username, activeBoardId]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <div className="glass-panel flex items-center gap-3 px-5 py-3 font-bold">
          <Loader2 className="h-5 w-5 animate-spin text-ember" />
          Loading profile...
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <section className="glass-panel max-w-lg p-8 text-center">
          <EyeOff className="mx-auto h-9 w-9 text-ember" />
          <h1 className="mt-3 text-2xl font-black">{error.includes("private") ? "This profile is private." : "Profile unavailable"}</h1>
          <p className="mt-2 text-sm font-semibold text-black/50">{error}</p>
          <button onClick={onBack} className="mt-6 rounded-2xl bg-ink px-5 py-3 font-black text-white">Back to PinMind</button>
        </section>
      </main>
    );
  }

  const profile = data?.profile;
  const boards = data?.boards || [];

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 font-black shadow-sm ring-1 ring-white/70">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <section className="glass-panel p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <img
              src={profile?.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(profile?.displayName || username)}`}
              alt=""
              className="h-24 w-24 rounded-3xl object-cover shadow-sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black">{profile?.displayName || profile?.username}</h1>
                {data?.isOwner ? <span className="rounded-full bg-blush px-3 py-1 text-xs font-black text-ember">you</span> : null}
                <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black text-black/45">
                  {profile?.profileVisibility || "private"}
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-black/45">@{profile?.username}</p>
              {profile?.bio ? <p className="mt-3 max-w-2xl font-semibold leading-7 text-black/60">{profile.bio}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-black/50">
                {profile?.location ? <span className="rounded-full bg-white/70 px-3 py-1.5">{profile.location}</span> : null}
                {profile?.websiteUrl ? (
                  <a href={profile.websiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5">
                    Website <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(profile?.interests || []).map((interest) => (
                  <span key={interest} className="rounded-full bg-ink/5 px-3 py-1.5 text-xs font-black text-black/55">{interest}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {!boards.length ? (
          <section className="mt-6 rounded-[2rem] border border-dashed border-black/15 bg-white p-10 text-center">
            <Lock className="mx-auto h-8 w-8 text-black/30" />
            <p className="mt-3 text-lg font-black">
              {data?.isOwner ? "No boards yet" : "This user has not made any boards public yet."}
            </p>
          </section>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]">
            <aside className="space-y-2">
              {boards.map((board) => (
                <button
                  key={board.id}
                  onClick={() => setActiveBoardId(board.id)}
                  className={`w-full rounded-2xl px-4 py-3 text-left font-black shadow-sm ring-1 ring-white/70 ${
                    activeBoardId === board.id ? "bg-ink text-white" : "bg-white/70 text-black/65"
                  }`}
                >
                  {board.name}
                  <span className="mt-1 flex items-center gap-2 text-xs opacity-60">
                    {board.visibility === "public" ? <Globe2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {board.visibility === "public" ? "Public" : "Private"} · {board.pinCount} pins
                  </span>
                </button>
              ))}
            </aside>
            <section>
              {loadingBoard ? (
                <div className="glass-panel p-8 font-bold text-black/50">Loading board...</div>
              ) : (
                <>
                  <div className="mb-4">
                    <p className="text-xs font-black uppercase text-ember">{activeBoard?.board?.visibility || "public"} board</p>
                    <h2 className="text-2xl font-black">{activeBoard?.board?.name}</h2>
                    <p className="mt-1 text-sm font-semibold text-black/50">{activeBoard?.board?.description}</p>
                  </div>
                  <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
                    {(activeBoard?.pins || []).map((pin) => (
                      <article key={pin.id} className="mb-4 break-inside-avoid overflow-hidden rounded-[1.5rem] bg-white shadow-sm">
                        <img src={pin.imageUrl} alt={pin.title} loading="lazy" className="w-full object-cover" />
                        <div className="p-4">
                          <h3 className="font-black">{pin.title}</h3>
                          {pin.caption ? <p className="mt-1 text-sm font-semibold text-black/50">{pin.caption}</p> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
