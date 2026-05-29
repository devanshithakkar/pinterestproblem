import { BrainCircuit, TrendingUp, WandSparkles } from "lucide-react";
import ConfidenceBadge from "./ConfidenceBadge";

export default function RecommendationStrip({ recommendations }) {
  if (!recommendations?.length) return null;

  return (
    <section className="mt-8">
      <div className="glass-panel relative overflow-hidden p-5 md:p-6">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-ember/15 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-moss/12 blur-3xl" />
      <div className="relative mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/58 px-3 py-1.5 text-xs font-black uppercase text-ember shadow-sm ring-1 ring-white/70">
            <WandSparkles className="h-3.5 w-3.5" />
            AI recommendations
          </p>
          <h2 className="mt-3 text-3xl font-black">Similar saves for this board</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-black/52">
            The mock engine blends board tags, saved pins, and correction history to suggest visual directions that match the board.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-black text-black/55">
          <span className="rounded-2xl bg-white/58 px-3 py-2 shadow-sm ring-1 ring-white/70">
            <BrainCircuit className="mb-1 h-4 w-4 text-ember" />
            Semantic fit
          </span>
          <span className="rounded-2xl bg-white/58 px-3 py-2 shadow-sm ring-1 ring-white/70">
            <TrendingUp className="mb-1 h-4 w-4 text-moss" />
            Taste drift
          </span>
        </div>
      </div>
      <div className="relative grid gap-4 md:grid-cols-2">
        {recommendations.map((item) => (
          <article
            key={item.id}
            className="group grid grid-cols-[120px_1fr] overflow-hidden rounded-[1.5rem] bg-white/66 shadow-sm ring-1 ring-white/70 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-lift"
          >
            <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-full min-h-40 w-full object-cover" />
            <div className="space-y-3 p-4">
              <ConfidenceBadge score={item.confidence} compact />
              <div>
                <h3 className="font-black">{item.title}</h3>
                <p className="mt-1 text-sm font-medium leading-6 text-black/55">{item.reason}</p>
              </div>
              <p className="text-xs font-bold text-moss">{item.learnedFrom}</p>
            </div>
          </article>
        ))}
      </div>
      </div>
    </section>
  );
}
