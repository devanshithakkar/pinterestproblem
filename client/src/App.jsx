import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { api } from "./lib/api";
import LandingPage from "./pages/LandingPage";
import BoardApp from "./pages/BoardApp";

export default function App() {
  const [showApp, setShowApp] = useState(false);
  const [boards, setBoards] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadBoards(preferredId) {
    setError("");
    const data = await api.getBoards();
    setBoards(data.boards);
    setActiveBoardId(preferredId || activeBoardId || data.boards[0]?.id || null);
  }

  useEffect(() => {
    loadBoards()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const activeBoard = useMemo(
    () => boards.find((board) => board.id === activeBoardId) || boards[0],
    [boards, activeBoardId],
  );

  return (
    <div className="min-h-screen text-ink">
      <AnimatePresence mode="wait">
        {!showApp ? (
          <LandingPage key="landing" onEnter={() => setShowApp(true)} boards={boards} />
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
                onBackHome={() => setShowApp(false)}
              />
            )}
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
