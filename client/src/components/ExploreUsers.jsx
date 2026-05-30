import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { api } from "../lib/api";

const UserCard = memo(function UserCard({ profile }) {
  const profileUrl = `/u/${encodeURIComponent(profile.username)}`;
  return (
    <article className="glass-panel p-4 transition hover:-translate-y-1 hover:shadow-lift">
      <div className="flex items-center gap-3">
        <img
          src={profile.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(profile.displayName || profile.username)}`}
          alt=""
          className="h-14 w-14 rounded-2xl object-cover"
        />
        <span className="min-w-0">
          <strong className="block truncate text-lg font-black">{profile.displayName || profile.username}</strong>
          <span className="block truncate text-sm font-bold text-black/45">@{profile.username}</span>
        </span>
      </div>
      {profile.bio ? <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-black/55">{profile.bio}</p> : null}
      <a
        href={profileUrl}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white"
      >
        View Profile
        <ArrowUpRight className="h-4 w-4" />
      </a>
    </article>
  );
});

export default function ExploreUsers() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const normalizedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(normalizedQuery);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [normalizedQuery]);

  useEffect(() => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);
    setError("");
    api
      .searchUsers({ query: debouncedQuery, page: 1 })
      .then((data) => {
        if (currentRequest !== requestId.current) return;
        setUsers(data.users || []);
      })
      .catch((err) => {
        if (currentRequest !== requestId.current) return;
        setError(err.message || "Unable to search users.");
      })
      .finally(() => {
        if (currentRequest === requestId.current) setLoading(false);
      });
  }, [debouncedQuery]);

  return (
    <section>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-ember">People</p>
          <h2 className="text-2xl font-black">Public PinMind profiles</h2>
        </div>
        <label className="flex w-full items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 shadow-sm ring-1 ring-white/70 sm:max-w-sm">
          <Search className="h-4 w-4 text-black/35" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search username or name"
            className="w-full bg-transparent text-sm font-bold outline-none"
          />
        </label>
      </div>
      {error ? <div className="mb-4 rounded-2xl bg-blush px-4 py-3 text-sm font-bold text-ember">{error}</div> : null}
      {loading ? <div className="mb-4 glass-panel p-5 font-bold text-black/50">Searching public profiles...</div> : null}
      {!loading && users.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {users.map((profile) => <UserCard key={profile.id} profile={profile} />)}
        </div>
      ) : null}
      {!loading && !users.length ? (
        <div className="rounded-[2rem] border border-dashed border-black/15 bg-white p-10 text-center">
          <p className="text-lg font-black">No public profiles found</p>
          <p className="mt-2 text-sm font-semibold text-black/50">Profiles appear here after users choose public visibility.</p>
        </div>
      ) : null}
    </section>
  );
}
