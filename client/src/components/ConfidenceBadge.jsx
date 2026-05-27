import { Sparkles } from "lucide-react";

export default function ConfidenceBadge({ score = 72, compact = false }) {
  const tone = score >= 86 ? "bg-moss text-white" : score >= 72 ? "bg-marigold text-ink" : "bg-blush text-ember";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${tone}`}>
      <Sparkles className={compact ? "h-3 w-3" : "h-4 w-4"} />
      {score}% AI confidence
    </span>
  );
}
