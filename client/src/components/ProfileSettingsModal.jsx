import { Eye, EyeOff, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

function profileToForm(profile, user) {
  return {
    username: profile?.username || "",
    displayName: profile?.displayName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "",
    avatarUrl: profile?.avatarUrl || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "",
    bio: profile?.bio || "",
    websiteUrl: profile?.websiteUrl || "",
    location: profile?.location || "",
    interests: (profile?.interests || []).join(", "),
    profileVisibility: profile?.profileVisibility || "private",
  };
}

export default function ProfileSettingsModal({ user, onClose }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(() => profileToForm(null, user));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    api
      .getMe()
      .then((data) => {
        if (!mounted) return;
        setProfile(data.profile);
        setForm(profileToForm(data.profile, user));
      })
      .catch((err) => setError(err.message || "Unable to load your profile."))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [user]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        username: form.username,
        displayName: form.displayName,
        avatarUrl: form.avatarUrl,
        bio: form.bio,
        websiteUrl: form.websiteUrl,
        location: form.location,
        interests: form.interests.split(",").map((item) => item.trim()).filter(Boolean),
        profileVisibility: form.profileVisibility,
      };
      const data = await api.updateProfile(payload);
      setProfile(data.profile);
      setForm(profileToForm(data.profile, user));
      setMessage("Profile saved.");
    } catch (err) {
      setError(err.message || "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
      <form onSubmit={saveProfile} className="max-h-[100dvh] w-full max-w-2xl overflow-y-auto rounded-t-[1.6rem] bg-white p-5 shadow-soft sm:rounded-[2rem] sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-ember">Profile settings</p>
            <h2 className="text-2xl font-black">Your public identity</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-black/[0.04]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl bg-black/[0.04] px-4 py-5 font-bold text-black/55">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading profile...
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <div>
              <img
                src={form.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(form.displayName || "P")}`}
                alt=""
                className="h-28 w-28 rounded-3xl object-cover shadow-sm ring-1 ring-black/5"
              />
            </div>
            <div className="grid gap-4">
              <label className="block text-sm font-black">
                Username
                <input
                  value={form.username}
                  onChange={(event) => updateField("username", event.target.value.toLowerCase())}
                  className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
                  placeholder="rishit"
                />
              </label>
              <label className="block text-sm font-black">
                Display name
                <input
                  value={form.displayName}
                  onChange={(event) => updateField("displayName", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
                />
              </label>
            </div>
            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-black sm:col-span-2">
                Avatar URL
                <input
                  value={form.avatarUrl}
                  onChange={(event) => updateField("avatarUrl", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
                  placeholder="https://..."
                />
              </label>
              <label className="block text-sm font-black sm:col-span-2">
                Bio
                <textarea
                  value={form.bio}
                  onChange={(event) => updateField("bio", event.target.value)}
                  className="mt-2 min-h-24 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
                  placeholder="What kind of visual worlds are you collecting?"
                />
              </label>
              <label className="block text-sm font-black">
                Website
                <input
                  value={form.websiteUrl}
                  onChange={(event) => updateField("websiteUrl", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
                  placeholder="https://..."
                />
              </label>
              <label className="block text-sm font-black">
                Location
                <input
                  value={form.location}
                  onChange={(event) => updateField("location", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
                />
              </label>
              <label className="block text-sm font-black sm:col-span-2">
                Interests
                <input
                  value={form.interests}
                  onChange={(event) => updateField("interests", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-ember"
                  placeholder="fashion, room decor, coding, concerts"
                />
              </label>
              <div className="sm:col-span-2 rounded-2xl border border-black/10 bg-black/[0.025] p-3">
                <p className="mb-2 text-sm font-black">Profile visibility</p>
                <div className="grid grid-cols-2 gap-2">
                  {["private", "public"].map((visibility) => {
                    const active = form.profileVisibility === visibility;
                    const Icon = visibility === "public" ? Eye : EyeOff;
                    return (
                      <button
                        key={visibility}
                        type="button"
                        onClick={() => updateField("profileVisibility", visibility)}
                        className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${
                          active ? "bg-ink text-white" : "bg-white text-black/55"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {visibility}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {error ? <div className="mt-4 rounded-2xl bg-blush px-4 py-3 text-sm font-bold text-ember">{error}</div> : null}
        {message ? <div className="mt-4 rounded-2xl bg-moss/10 px-4 py-3 text-sm font-bold text-moss">{message}</div> : null}
        <button disabled={saving || loading} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ember px-5 py-3 font-black text-white shadow-lift disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save profile
        </button>
        {profile?.username ? (
          <a href={`/u/${profile.username}`} className="mt-3 block text-center text-sm font-black text-ember">
            View public profile
          </a>
        ) : null}
      </form>
    </div>
  );
}
