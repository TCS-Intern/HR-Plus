"use client";

import { cn } from "@/lib/utils";

interface MatchBreakdown {
  skills_match?: number;
  experience_match?: number;
  education_match?: number;
  culture_fit?: number;
  [key: string]: number | undefined;
}

interface MatchScoreDisplayProps {
  breakdown: MatchBreakdown;
}

const categoryLabels: Record<string, string> = {
  skills_match: "Skills Match",
  experience_match: "Experience",
  education_match: "Education",
  culture_fit: "Culture Fit",
};

const getScoreColor = (score: number) => {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-rose-500";
};

const getScoreTextColor = (score: number) => {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-rose-600";
};

export default function MatchScoreDisplay({ breakdown }: MatchScoreDisplayProps) {
  const categories = Object.entries(breakdown)
    .filter(([key, value]) => value !== undefined && categoryLabels[key])
    .map(([key, value]) => ({
      key,
      label: categoryLabels[key],
      score: value as number,
    }));

  if (categories.length === 0) {
    return (
      <p className="text-sm text-zinc-500 italic">No breakdown available</p>
    );
  }

  return (
    <div className="space-y-3">
      {categories.map(({ key, label, score }) => (
        <div key={key}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-zinc-600">{label}</span>
            <span className={cn("text-sm font-semibold", getScoreTextColor(score))}>
              {score}%
            </span>
          </div>
          <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", getScoreColor(score))}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      ))}

      {/* Overall Score */}
      <div className="pt-3 border-t border-zinc-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-zinc-700">Overall Match</span>
          <span
            className={cn(
              "text-lg font-bold",
              getScoreTextColor(
                Math.round(categories.reduce((sum, c) => sum + c.score, 0) / categories.length)
              )
            )}
          >
            {Math.round(categories.reduce((sum, c) => sum + c.score, 0) / categories.length)}%
          </span>
        </div>
      </div>
    </div>
  );
}
