"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Check, Building2, MapPin, Star, Linkedin, Github, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourcedCandidate } from "@/types";
import { Button } from "@/components/ui/button";

interface CandidateApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: SourcedCandidate[];
  onApprove: (selectedIds: string[]) => Promise<void>;
  jobTitle: string;
}

export default function CandidateApprovalModal({
  isOpen,
  onClose,
  candidates,
  onApprove,
  jobTitle,
}: CandidateApprovalModalProps) {
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !submitting) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, submitting, onClose]);

  const toggleCandidate = (candidateId: string) => {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(candidateId)) {
      newSelected.delete(candidateId);
    } else {
      newSelected.add(candidateId);
    }
    setSelectedCandidates(newSelected);
  };

  const selectAll = () => {
    setSelectedCandidates(new Set(candidates.map((c) => c.id)));
  };

  const deselectAll = () => {
    setSelectedCandidates(new Set());
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onApprove(Array.from(selectedCandidates));
      onClose();
    } catch (error) {
      console.error("Error approving candidates:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const getFitScoreColor = (score: number | null) => {
    if (!score) return "bg-zinc-100 text-zinc-600";
    if (score >= 80) return "bg-emerald-50 text-emerald-700";
    if (score >= 60) return "bg-amber-50 text-amber-700";
    return "bg-rose-50 text-rose-700";
  };

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-xl shadow-lg border border-zinc-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Review Sourced Candidates</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Select candidates to add to the pipeline for <span className="font-semibold text-primary">{jobTitle}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 bg-zinc-50 border-b border-zinc-200">
          <div className="text-sm text-zinc-600">
            <span className="text-primary font-semibold">{selectedCandidates.size}</span>
            <span> of </span>
            <span className="font-semibold">{candidates.length}</span>
            <span> selected</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-accent-50 rounded-lg transition-colors"
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Candidates List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-zinc-100 rounded-xl flex items-center justify-center mb-4">
                <Star className="text-zinc-400" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">No candidates found</h3>
              <p className="text-sm text-zinc-500 max-w-md">
                We couldn&apos;t find any candidates for this job. Try adjusting your search criteria or source
                manually.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  onClick={() => toggleCandidate(candidate.id)}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all",
                    selectedCandidates.has(candidate.id)
                      ? "border-primary bg-accent-50"
                      : "border-zinc-200 hover:border-zinc-300 bg-white"
                  )}
                >
                  {/* Checkbox */}
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                        selectedCandidates.has(candidate.id)
                          ? "border-primary bg-primary"
                          : "border-zinc-300 bg-white"
                      )}
                    >
                      {selectedCandidates.has(candidate.id) && <Check size={14} className="text-white" />}
                    </div>
                  </div>

                  {/* Candidate Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-zinc-900">
                          {candidate.first_name} {candidate.last_name}
                        </h4>
                        {candidate.current_title && (
                          <p className="text-sm text-zinc-500 mt-0.5">{candidate.current_title}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-sm text-zinc-500">
                          {candidate.current_company && (
                            <div className="flex items-center gap-1">
                              <Building2 size={14} />
                              <span>{candidate.current_company}</span>
                            </div>
                          )}
                          {candidate.location && (
                            <div className="flex items-center gap-1">
                              <MapPin size={14} />
                              <span>{candidate.location}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Fit Score */}
                      {candidate.fit_score != null && (
                        <div
                          className={cn(
                            "flex-shrink-0 px-3 py-1.5 rounded-lg font-semibold text-sm",
                            getFitScoreColor(candidate.fit_score)
                          )}
                        >
                          {candidate.fit_score}% Match
                        </div>
                      )}
                    </div>

                    {/* Skills */}
                    {candidate.skills && candidate.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {candidate.skills.slice(0, 5).map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-zinc-100 text-zinc-700 text-xs rounded-md"
                          >
                            {skill}
                          </span>
                        ))}
                        {candidate.skills.length > 5 && (
                          <span className="px-2 py-1 text-zinc-500 text-xs">
                            +{candidate.skills.length - 5} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Contact & Links */}
                    <div className="flex items-center gap-3 mt-3">
                      {candidate.email && (
                        <span className="text-xs text-zinc-500">{candidate.email}</span>
                      )}
                      <div className="flex gap-2">
                        {candidate.source === "linkedin" && candidate.source_url && (
                          <a
                            href={candidate.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-zinc-400 hover:text-blue-600 transition-colors"
                          >
                            <Linkedin size={16} />
                          </a>
                        )}
                        {candidate.source === "github" && candidate.source_url && (
                          <a
                            href={candidate.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-zinc-400 hover:text-zinc-900 transition-colors"
                          >
                            <Github size={16} />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Fit Analysis */}
                    {candidate.fit_analysis?.reasoning && (
                      <p className="text-sm text-zinc-500 mt-3 italic">{candidate.fit_analysis.reasoning}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50">
          <div className="text-sm text-zinc-600">
            {selectedCandidates.size > 0 && (
              <span className="font-medium text-primary">
                {selectedCandidates.size} candidate{selectedCandidates.size > 1 ? "s" : ""} ready to add
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || selectedCandidates.size === 0}
              loading={submitting}
            >
              {submitting
                ? "Adding to Pipeline..."
                : `Add ${selectedCandidates.size > 0 ? selectedCandidates.size : ""} to Pipeline`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
