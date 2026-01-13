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
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
};

const getScoreTextColor = (score: number) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
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
      <p className="text-sm text-slate-500 italic">No breakdown available</p>
    );
  }

  return (
    <div className="space-y-3">
      {categories.map(({ key, label, score }) => (
        <div key={key}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
            <span className={cn("text-sm font-semibold", getScoreTextColor(score))}>
              {score}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", getScoreColor(score))}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      ))}

      {/* Overall Score */}
      <div className="pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Overall Match
          </span>
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
