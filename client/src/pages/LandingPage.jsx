import { motion } from "framer-motion";
import { ArrowRight, BrainCircuit, Image, LayoutDashboard, Sparkles } from "lucide-react";

const heroImages = [
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=700&q=80",
];

export default function LandingPage({ onEnter, boards }) {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen overflow-hidden"
    >
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <button className="flex items-center gap-3 rounded-3xl p-2 hover:bg-white/50">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ember text-lg font-black text-white shadow-lift">P</span>
          <span className="text-xl font-black">PinMind</span>
        </button>
        <button onClick={onEnter} className="rounded-full bg-ink px-5 py-3 text-sm font-black text-white shadow-soft hover:-translate-y-0.5">
          Open app
        </button>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/54 px-4 py-2 text-sm font-black text-ember shadow-sm backdrop-blur-xl">
            <Sparkles className="h-4 w-4" />
            Mock AI, real-feeling organization
          </div>
          <h1 className="text-5xl font-black leading-[0.98] tracking-normal sm:text-6xl lg:text-7xl">
            PinMind
          </h1>
          <p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-black/58">
            A Pinterest-inspired smart board organizer that predicts where every saved image belongs, explains why,
            learns from corrections, and suggests visually similar ideas for each board.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onEnter}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ember px-6 py-4 font-black text-white shadow-lift transition hover:-translate-y-0.5"
            >
              Start organizing
              <ArrowRight className="h-5 w-5" />
            </button>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/70 bg-white/50 p-2 shadow-sm backdrop-blur-xl">
              {boards.slice(0, 3).map((board) => (
                <span key={board.id} className="rounded-xl bg-white/58 px-3 py-2 text-center text-xs font-black text-black/60 shadow-sm">
                  {board.name}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              ["Predict", BrainCircuit, "Caption, filename, tags"],
              ["Save", Image, "Auto-board placement"],
              ["Learn", LayoutDashboard, "Correction-aware scoring"],
            ].map(([title, Icon, body]) => (
              <article key={title} className="glass-panel p-4 transition duration-300 hover:-translate-y-1">
                <Icon className="mb-3 h-5 w-5 text-ember" />
                <h3 className="font-black">{title}</h3>
                <p className="mt-1 text-sm font-semibold text-black/50">{body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="relative min-h-[620px]">
          <div className="absolute inset-0 columns-2 gap-4 sm:columns-3">
            {heroImages.map((src, index) => (
              <motion.img
                key={src}
                src={src}
                alt=""
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.5 }}
                className={`mb-4 w-full break-inside-avoid rounded-[2rem] object-cover shadow-soft transition duration-500 hover:-translate-y-1 hover:scale-[1.01] ${
                  index % 2 ? "h-72" : "h-96"
                }`}
              />
            ))}
          </div>
          <div className="glass-panel absolute bottom-8 left-5 right-5 p-5 sm:left-auto sm:w-80">
            <p className="text-xs font-black uppercase text-ember">Live prediction</p>
            <h2 className="mt-1 text-xl font-black">Room Decor</h2>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/10">
              <div className="h-full w-[91%] rounded-full bg-moss" />
            </div>
            <p className="mt-3 text-sm font-bold text-black/55">91% confidence from plant, lamp, room, natural light.</p>
          </div>
        </div>
      </section>
    </motion.main>
  );
}
