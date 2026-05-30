import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { api } from "./lib/api";
import { supabase, upsertUserProfile } from "./lib/supabaseClient";
import AuthGate from "./components/AuthGate";
import LandingPage from "./pages/LandingPage";
import BoardApp from "./pages/BoardApp";
import PublicProfilePage from "./pages/PublicProfilePage";

export default function App() {
  const [showApp, setShowApp] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [boards, setBoards] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState("");
  const [locationPath, setLocationPath] = useState(window.location.pathname);
  const publicProfileMatch = locationPath.match(/^\/u\/([^/]+)\/?$/);
  const publicProfileUsername = publicProfileMatch?.[1] ? decodeURIComponent(publicProfileMatch[1]) : null;

  async function loadBoards(preferredId) {
    setError("");
    try {
      const data = await api.getBoards();
      setBoards(data.boards);
      setActiveBoardId((currentId) => {
        if (preferredId && data.boards.some((board) => board.id === preferredId)) return preferredId;
        if (currentId && data.boards.some((board) => board.id === currentId)) return currentId;
        return data.boards[0]?.id || null;
      });
    } catch (err) {
      setError(err.message || "Unable to refresh boards.");
      throw err;
    }
  }

  async function handleBoardCreated(board) {
    if (!board?.id) {
      await loadBoards();
      return;
    }
    setBoards((currentBoards) => {
      const withoutCreated = currentBoards.filter((item) => item.id !== board.id);
      return [board, ...withoutCreated];
    });
    setActiveBoardId(board.id);
    await loadBoards(board.id);
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session || null);
        setShowApp(Boolean(data.session));
        if (data.session?.user) {
          upsertUserProfile(data.session.user).catch((err) => setAuthError(err.message));
        }
      })
      .finally(() => mounted && setAuthLoading(false));

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      setSession(nextSession);
      if (event === "SIGNED_OUT") {
        setBoards([]);
        setActiveBoardId(null);
      }
      setShowApp(Boolean(nextSession));
      if (nextSession?.user) {
        upsertUserProfile(nextSession.user).catch((err) => setAuthError(err.message));
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function syncLocation() {
      setLocationPath(window.location.pathname);
    }
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, []);

  useEffect(() => {
    async function refreshOnFocus() {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setSession(null);
        return;
      }
      setSession(data.session);
      if (showApp) {
        loadBoards(activeBoardId).catch((err) => {
          if (import.meta.env.DEV) console.debug("[PinMind] Focus refresh kept previous boards after error.", err);
        });
      }
    }

    document.addEventListener("visibilitychange", refreshOnFocus);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [activeBoardId, showApp]);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    setLoading(true);
    loadBoards()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const activeBoard = useMemo(
    () => boards.find((board) => board.id === activeBoardId) || boards[0],
    [boards, activeBoardId],
  );

  return (
    <div className="min-h-screen text-ink">
      <AnimatePresence mode="wait">
        {authLoading ? (
          <div className="grid min-h-screen place-items-center px-5">
            <div className="glass-panel flex items-center gap-3 px-5 py-3">
              <Sparkles className="h-5 w-5 animate-pulse text-ember" />
              <span className="font-semibold">Checking your session...</span>
            </div>
          </div>
        ) : !session ? (
          <AuthGate key="auth" authError={authError} />
        ) : publicProfileUsername ? (
          <PublicProfilePage
            key={`profile-${publicProfileUsername}`}
            username={publicProfileUsername}
            onBack={() => {
              window.history.pushState({}, "", "/");
              setLocationPath("/");
              setShowApp(true);
            }}
          />
        ) : !showApp ? (
          <LandingPage key="landing" onEnter={() => setShowApp(true)} boards={boards} user={session.user} />
        ) : (
          <motion.main
            key="app"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
          >
            {loading ? (
              <div className="grid min-h-screen place-items-center px-5">
                <div className="glass-panel flex items-center gap-3 px-5 py-3">
                  <Sparkles className="h-5 w-5 animate-pulse text-ember" />
                  <span className="font-semibold">Teaching the boards their taste...</span>
                </div>
              </div>
            ) : (
              <BoardApp
                boards={boards}
                activeBoard={activeBoard}
                activeBoardId={activeBoardId}
                error={error}
                onSelectBoard={setActiveBoardId}
                onBoardsChange={loadBoards}
                onBoardCreated={handleBoardCreated}
                onBackHome={() => setShowApp(false)}
                user={session.user}
              />
            )}
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
