"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Check, Building2, MapPin, Star, Linkedin, Github, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourcedCandidate } from "@/types";

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

  // Track if component is mounted (for SSR compatibility)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll when modal is open
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

  // Close modal on Escape key
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
    if (!score) return "bg-slate-100 text-slate-600";
    if (score >= 80) return "bg-green-100 text-green-700";
    if (score >= 60) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  };

  // Don't render on server or if not open
  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-200 ease-out"
      onClick={onClose}
      style={{ animation: "fadeIn 0.2s ease-out" }}
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col transition-all duration-200 ease-out"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "scaleIn 0.2s ease-out" }}
      >
        <style jsx>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b bg-gradient-to-r from-indigo-50 to-white rounded-t-xl">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Review Sourced Candidates</h2>
            <p className="text-sm text-slate-600 mt-1.5">
              Select candidates to add to the pipeline for <span className="font-semibold text-indigo-600">{jobTitle}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-lg transition-all hover:shadow-sm"
          >
            <X size={22} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b shadow-sm">
          <div className="text-sm font-medium text-slate-700">
            <span className="text-indigo-600 font-semibold text-base">{selectedCandidates.size}</span>
            <span className="text-slate-500"> of </span>
            <span className="font-semibold">{candidates.length}</span>
            <span className="text-slate-500"> selected</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all border border-transparent hover:border-indigo-200"
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-all border border-transparent hover:border-slate-200"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Candidates List */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50/50">
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-slate-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <Star className="text-indigo-400" size={36} />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No candidates found</h3>
              <p className="text-sm text-slate-600 max-w-md">
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
                    "flex items-start gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md",
                    selectedCandidates.has(candidate.id)
                      ? "border-indigo-500 bg-gradient-to-r from-indigo-50 to-white shadow-sm"
                      : "border-slate-200 hover:border-indigo-200 bg-white"
                  )}
                >
                  {/* Checkbox */}
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                        selectedCandidates.has(candidate.id)
                          ? "border-indigo-600 bg-indigo-600"
                          : "border-slate-300 bg-white"
                      )}
                    >
                      {selectedCandidates.has(candidate.id) && <Check size={14} className="text-white" />}
                    </div>
                  </div>

                  {/* Candidate Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-slate-900">
                          {candidate.first_name} {candidate.last_name}
                        </h4>
                        {candidate.current_title && (
                          <p className="text-sm text-slate-600 mt-0.5">{candidate.current_title}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
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
                            className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-md"
                          >
                            {skill}
                          </span>
                        ))}
                        {candidate.skills.length > 5 && (
                          <span className="px-2 py-1 text-slate-500 text-xs">
                            +{candidate.skills.length - 5} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Contact & Links */}
                    <div className="flex items-center gap-3 mt-3">
                      {candidate.email && (
                        <span className="text-xs text-slate-600">{candidate.email}</span>
                      )}
                      <div className="flex gap-2">
                        {candidate.source === "linkedin" && candidate.source_url && (
                          <a
                            href={candidate.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
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
                            className="text-slate-400 hover:text-slate-900 transition-colors"
                          >
                            <Github size={16} />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Fit Analysis */}
                    {candidate.fit_analysis?.reasoning && (
                      <p className="text-sm text-slate-600 mt-3 italic">{candidate.fit_analysis.reasoning}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gradient-to-r from-slate-50 to-white rounded-b-xl shadow-lg">
          <div className="text-sm text-slate-600">
            {selectedCandidates.size > 0 && (
              <span className="font-medium text-indigo-600">
                {selectedCandidates.size} candidate{selectedCandidates.size > 1 ? "s" : ""} ready to add
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 font-medium text-slate-700 hover:bg-white border border-slate-200 rounded-lg transition-all disabled:opacity-50 hover:shadow-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || selectedCandidates.size === 0}
              className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md hover:shadow-lg disabled:shadow-none"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Adding to Pipeline...
                </>
              ) : (
                <>Add {selectedCandidates.size > 0 ? selectedCandidates.size : ""} to Pipeline</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render modal outside of parent container
  return createPortal(modalContent, document.body);
}
