"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Send,
  Edit2,
  Calendar,
  Clock,
  Gift,
  Briefcase,
  FileText,
  MessageSquare,
  X,
  Plus,
  Eye,
  Download,
  RotateCcw,
  Check,
  Circle,
} from "lucide-react";
import { cn, formatCurrency, formatShortDate } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { offerApi, emailApi } from "@/lib/api/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { Mail } from "lucide-react";

interface Benefit {
  benefit_type: string;
  description: string;
  value_estimate: number | null;
}

interface NegotiationNote {
  timestamp: string;
  note: string;
  actor: string;
}

interface NegotiationGuidance {
  salary_flexibility?: {
    min: number;
    max: number;
  };
  other_levers?: string[];
  walk_away_point?: number;
}

interface Offer {
  id: string;
  application_id: string;
  base_salary: number;
  currency: string;
  signing_bonus: number;
  annual_bonus_target: number | null;
  equity_type: string | null;
  equity_amount: number | null;
  equity_vesting_schedule: string | null;
  benefits: Benefit[];
  start_date: string | null;
  offer_expiry_date: string | null;
  offer_letter_url: string | null;
  contract_url: string | null;
  contingencies: string[];
  negotiation_notes: NegotiationNote[];
  negotiation_guidance: NegotiationGuidance | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  response_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Candidate {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
}

interface Job {
  title: string;
  department: string | null;
  salary_range?: {
    min: number | null;
    max: number | null;
    currency: string;
  };
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", color: "text-slate-600", bgColor: "bg-slate-100", icon: <Circle className="w-4 h-4" /> },
  pending_approval: { label: "Pending Approval", color: "text-amber-600", bgColor: "bg-amber-100", icon: <Clock className="w-4 h-4" /> },
  approved: { label: "Approved", color: "text-blue-600", bgColor: "bg-blue-100", icon: <Check className="w-4 h-4" /> },
  sent: { label: "Sent", color: "text-purple-600", bgColor: "bg-purple-100", icon: <Send className="w-4 h-4" /> },
  viewed: { label: "Viewed", color: "text-indigo-600", bgColor: "bg-indigo-100", icon: <Eye className="w-4 h-4" /> },
  accepted: { label: "Accepted", color: "text-green-600", bgColor: "bg-green-100", icon: <CheckCircle className="w-4 h-4" /> },
  rejected: { label: "Rejected", color: "text-red-600", bgColor: "bg-red-100", icon: <XCircle className="w-4 h-4" /> },
  negotiating: { label: "Negotiating", color: "text-orange-600", bgColor: "bg-orange-100", icon: <MessageSquare className="w-4 h-4" /> },
  expired: { label: "Expired", color: "text-gray-600", bgColor: "bg-gray-100", icon: <Clock className="w-4 h-4" /> },
};

// Define status flow order
const statusOrder = ["draft", "pending_approval", "approved", "sent", "viewed", "negotiating", "accepted", "rejected", "expired"];

export default function OfferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = params.id as string;

  const [offer, setOffer] = useState<Offer | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showLetterPreview, setShowLetterPreview] = useState(false);
  const [showNegotiationForm, setShowNegotiationForm] = useState(false);
  const [showCounterOfferForm, setShowCounterOfferForm] = useState(false);
  const [emailPreview, setEmailPreview] = useState<{
    show: boolean;
    loading: boolean;
    data: {
      subject?: string;
      to_email?: string;
      to_name?: string;
      html_content?: string;
    } | null;
  }>({ show: false, loading: false, data: null });

  // Counter offer form state
  const [counterOffer, setCounterOffer] = useState({
    base_salary: 0,
    signing_bonus: 0,
    note: "",
  });

  // Negotiation note state
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    async function fetchData() {
      // Fetch offer
      const { data: offerData, error: offerError } = await supabase
        .from("offers")
        .select("*")
        .eq("id", offerId)
        .single();

      if (offerError) {
        console.error("Error fetching offer:", offerError);
        setLoading(false);
        return;
      }

      setOffer(offerData);
      setCounterOffer({
        base_salary: offerData.base_salary,
        signing_bonus: offerData.signing_bonus || 0,
        note: "",
      });

      // Fetch application with related data
      if (offerData?.application_id) {
        const { data: appData, error: appError } = await supabase
          .from("applications")
          .select("*, candidates(*), jobs(*)")
          .eq("id", offerData.application_id)
          .single();

        if (!appError && appData) {
          setCandidate(appData.candidates);
          setJob(appData.jobs);
        }
      }

      setLoading(false);
    }

    fetchData();
  }, [offerId]);

  const refreshOffer = async () => {
    const { data } = await supabase.from("offers").select("*").eq("id", offerId).single();
    if (data) setOffer(data);
  };

  const handleApprove = async () => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from("offers")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", offerId);

      if (error) throw error;
      toast.success("Offer approved!");
      await refreshOffer();
    } catch (error) {
      console.error("Error approving offer:", error);
      toast.error("Failed to approve offer");
    }
    setUpdatingStatus(false);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await offerApi.send(offerId);
      toast.success("Offer sent to candidate!");
      await refreshOffer();
    } catch (error) {
      console.error("Error sending offer:", error);
      toast.error("Failed to send offer");
    }
    setSending(false);
  };

  const handleWithdraw = async () => {
    if (!confirm("Are you sure you want to withdraw this offer?")) return;

    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from("offers")
        .update({
          status: "draft",
          sent_at: null,
          viewed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", offerId);

      if (error) throw error;
      toast.success("Offer withdrawn and reset to draft");
      await refreshOffer();
    } catch (error) {
      console.error("Error withdrawing offer:", error);
      toast.error("Failed to withdraw offer");
    }
    setUpdatingStatus(false);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const updates: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "accepted" || newStatus === "rejected") {
        updates.responded_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("offers")
        .update(updates)
        .eq("id", offerId);

      if (error) throw error;
      toast.success(`Offer marked as ${newStatus}`);
      await refreshOffer();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
    setUpdatingStatus(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setAddingNote(true);
    try {
      const existingNotes = offer?.negotiation_notes || [];
      const newNoteObj: NegotiationNote = {
        timestamp: new Date().toISOString(),
        note: newNote,
        actor: "Recruiter",
      };

      const { error } = await supabase
        .from("offers")
        .update({
          negotiation_notes: [...existingNotes, newNoteObj],
          updated_at: new Date().toISOString(),
        })
        .eq("id", offerId);

      if (error) throw error;
      toast.success("Note added");
      setNewNote("");
      setShowNegotiationForm(false);
      await refreshOffer();
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Failed to add note");
    }
    setAddingNote(false);
  };

  const handleSubmitCounterOffer = async () => {
    setUpdatingStatus(true);
    try {
      const existingNotes = offer?.negotiation_notes || [];
      const counterNote: NegotiationNote = {
        timestamp: new Date().toISOString(),
        note: `Counter offer submitted: Base salary ${formatCurrency(counterOffer.base_salary)}, Signing bonus ${formatCurrency(counterOffer.signing_bonus)}. ${counterOffer.note}`,
        actor: "Candidate",
      };

      const { error } = await supabase
        .from("offers")
        .update({
          negotiation_notes: [...existingNotes, counterNote],
          status: "negotiating",
          updated_at: new Date().toISOString(),
        })
        .eq("id", offerId);

      if (error) throw error;
      toast.success("Counter offer recorded");
      setShowCounterOfferForm(false);
      await refreshOffer();
    } catch (error) {
      console.error("Error submitting counter offer:", error);
      toast.error("Failed to submit counter offer");
    }
    setUpdatingStatus(false);
  };

  const handleAcceptCounterOffer = async () => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from("offers")
        .update({
          base_salary: counterOffer.base_salary,
          signing_bonus: counterOffer.signing_bonus,
          status: "sent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", offerId);

      if (error) throw error;
      toast.success("Offer updated with counter terms");
      setShowCounterOfferForm(false);
      await refreshOffer();
    } catch (error) {
      console.error("Error accepting counter offer:", error);
      toast.error("Failed to update offer");
    }
    setUpdatingStatus(false);
  };

  const handlePreviewOfferEmail = async () => {
    setEmailPreview({ show: true, loading: true, data: null });
    try {
      const response = await emailApi.previewOffer(offerId);
      setEmailPreview({
        show: true,
        loading: false,
        data: response.data,
      });
    } catch (error) {
      console.error("Error previewing offer email:", error);
      toast.error("Failed to load email preview");
      setEmailPreview({ show: false, loading: false, data: null });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Offer not found</h2>
        <Link href="/offers" className="text-primary hover:underline">
          Back to offers
        </Link>
      </div>
    );
  }

  const status = statusConfig[offer.status] || statusConfig.draft;
  const totalCompensation =
    offer.base_salary +
    (offer.signing_bonus || 0) +
    (offer.base_salary * (offer.annual_bonus_target || 0)) / 100;

  // Build timeline events
  const timelineEvents = [
    { status: "draft", date: offer.created_at, label: "Created" },
    offer.approved_at && { status: "approved", date: offer.approved_at, label: "Approved" },
    offer.sent_at && { status: "sent", date: offer.sent_at, label: "Sent" },
    offer.viewed_at && { status: "viewed", date: offer.viewed_at, label: "Viewed" },
    offer.responded_at && {
      status: offer.status === "accepted" ? "accepted" : offer.status === "rejected" ? "rejected" : "negotiating",
      date: offer.responded_at,
      label: offer.status === "accepted" ? "Accepted" : offer.status === "rejected" ? "Rejected" : "Response",
    },
  ].filter(Boolean) as { status: string; date: string; label: string }[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/offers"
            className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-slate-600 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                Offer for {candidate ? `${candidate.first_name} ${candidate.last_name}` : "Candidate"}
              </h1>
              <span className={cn("px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1", status.bgColor, status.color)}>
                {status.icon}
                {status.label}
              </span>
            </div>
            <p className="text-sm text-slate-500">{job?.title || "Position"} {job?.department ? `- ${job.department}` : ""}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* View Offer Letter */}
          {offer.offer_letter_url && (
            <button
              onClick={() => setShowLetterPreview(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white transition-all"
            >
              <Eye className="w-4 h-4" />
              Preview Letter
            </button>
          )}

          {/* Action Buttons based on status */}
          {offer.status === "draft" && (
            <button
              onClick={handleApprove}
              disabled={updatingStatus}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-all disabled:opacity-50"
            >
              {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Approve
            </button>
          )}

          {offer.status === "approved" && (
            <>
              <button
                onClick={handlePreviewOfferEmail}
                disabled={emailPreview.loading}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition-all disabled:opacity-50"
              >
                {emailPreview.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Preview Email
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Offer
              </button>
            </>
          )}

          {(offer.status === "sent" || offer.status === "viewed") && (
            <>
              <button
                onClick={() => handleUpdateStatus("accepted")}
                disabled={updatingStatus}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition-all disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Mark Accepted
              </button>
              <button
                onClick={() => setShowCounterOfferForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                Counter Offer
              </button>
              <button
                onClick={() => handleUpdateStatus("rejected")}
                disabled={updatingStatus}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Mark Rejected
              </button>
              <button
                onClick={handleWithdraw}
                disabled={updatingStatus}
                className="flex items-center gap-2 px-4 py-2 bg-slate-500 text-white rounded-xl text-sm font-medium hover:bg-slate-600 transition-all disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                Withdraw
              </button>
            </>
          )}

          {offer.status === "negotiating" && (
            <>
              <button
                onClick={handleAcceptCounterOffer}
                disabled={updatingStatus}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition-all disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Accept Counter Terms
              </button>
              <button
                onClick={() => handleUpdateStatus("sent")}
                disabled={updatingStatus}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Send Updated Offer
              </button>
              <button
                onClick={() => handleUpdateStatus("rejected")}
                disabled={updatingStatus}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Decline
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="glass-card rounded-3xl p-6">
        <h2 className="font-bold text-slate-800 dark:text-white mb-4">Status Timeline</h2>
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {timelineEvents.map((event, index) => {
            const config = statusConfig[event.status];
            return (
              <div key={index} className="flex items-center">
                <div className="flex flex-col items-center min-w-[100px]">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", config.bgColor, config.color)}>
                    {config.icon}
                  </div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-2">{event.label}</p>
                  <p className="text-xs text-slate-500">{formatShortDate(event.date)}</p>
                </div>
                {index < timelineEvents.length - 1 && (
                  <div className="flex-1 h-0.5 bg-primary/30 min-w-[40px] mx-2" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Compensation */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-bold text-slate-800 dark:text-white mb-4">Compensation Package</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-primary/5 rounded-2xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Base Salary</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(offer.base_salary, offer.currency)}</p>
                <p className="text-xs text-slate-500">per year</p>
              </div>
              {offer.signing_bonus > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Signing Bonus</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(offer.signing_bonus, offer.currency)}</p>
                  <p className="text-xs text-slate-500">one-time</p>
                </div>
              )}
              {offer.annual_bonus_target && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Target Bonus</p>
                  <p className="text-xl font-bold text-amber-600">{offer.annual_bonus_target}%</p>
                  <p className="text-xs text-slate-500">of base</p>
                </div>
              )}
              {offer.equity_type && offer.equity_type !== "none" && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Equity</p>
                  <p className="text-xl font-bold text-purple-600">
                    {offer.equity_amount?.toLocaleString()} {offer.equity_type?.toUpperCase()}
                  </p>
                  <p className="text-xs text-slate-500">{offer.equity_vesting_schedule || "4-year vest"}</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Total First Year Compensation (Est.)</span>
                <span className="text-2xl font-bold text-slate-800 dark:text-white">
                  {formatCurrency(totalCompensation, offer.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Benefits */}
          {offer.benefits && offer.benefits.length > 0 && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">Benefits</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {offer.benefits.map((benefit, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Gift className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white text-sm">
                        {benefit.benefit_type}
                      </p>
                      <p className="text-xs text-slate-500">{benefit.description}</p>
                      {benefit.value_estimate && (
                        <p className="text-xs text-primary mt-1">
                          Est. value: {formatCurrency(benefit.value_estimate)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contingencies */}
          {offer.contingencies && offer.contingencies.length > 0 && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">Contingencies</h2>
              <ul className="space-y-2">
                {offer.contingencies.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Negotiation Notes */}
          <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 dark:text-white">Comments & Notes</h2>
              <button
                onClick={() => setShowNegotiationForm(!showNegotiationForm)}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Note
              </button>
            </div>

            {showNegotiationForm && (
              <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note about this offer or negotiation..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent resize-none mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddNote}
                    disabled={addingNote || !newNote.trim()}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Note"}
                  </button>
                  <button
                    onClick={() => {
                      setShowNegotiationForm(false);
                      setNewNote("");
                    }}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {offer.negotiation_notes && offer.negotiation_notes.length > 0 ? (
              <div className="space-y-3">
                {offer.negotiation_notes.map((note, i) => (
                  <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        note.actor === "Candidate"
                          ? "bg-blue-100 text-blue-600"
                          : "bg-slate-100 text-slate-600"
                      )}>
                        {note.actor}
                      </span>
                      <span className="text-xs text-slate-400">
                        {format(new Date(note.timestamp), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{note.note}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">No notes yet</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Candidate Info */}
          {candidate && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">Candidate</h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{candidate.first_name.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white">
                    {candidate.first_name} {candidate.last_name}
                  </p>
                  <p className="text-sm text-slate-500">{candidate.email}</p>
                </div>
              </div>
              {candidate.phone && (
                <p className="text-sm text-slate-600 dark:text-slate-400">Phone: {candidate.phone}</p>
              )}
            </div>
          )}

          {/* Key Dates */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-bold text-slate-800 dark:text-white mb-4">Key Dates</h2>
            <div className="space-y-4">
              {offer.start_date && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Proposed Start Date</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-white">
                      {format(new Date(offer.start_date), "MMMM d, yyyy")}
                    </p>
                  </div>
                </div>
              )}
              {offer.offer_expiry_date && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Offer Expires</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-white">
                      {format(new Date(offer.offer_expiry_date), "MMMM d, yyyy")}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Created</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-white">
                    {formatDistanceToNow(new Date(offer.created_at))} ago
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Negotiation Guidance */}
          {offer.negotiation_guidance && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">Negotiation Guidance</h2>
              {offer.negotiation_guidance.salary_flexibility && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-1">Salary Flexibility</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {formatCurrency(offer.negotiation_guidance.salary_flexibility.min)} -{" "}
                    {formatCurrency(offer.negotiation_guidance.salary_flexibility.max)}
                  </p>
                </div>
              )}
              {offer.negotiation_guidance.other_levers &&
                offer.negotiation_guidance.other_levers.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-500 mb-2">Other Levers</p>
                    <ul className="space-y-1">
                      {offer.negotiation_guidance.other_levers.map((lever, i) => (
                        <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-primary" />
                          {lever}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              {offer.negotiation_guidance.walk_away_point && (
                <div className="pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                  <p className="text-xs text-red-500 mb-1">Walk Away Point</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {formatCurrency(offer.negotiation_guidance.walk_away_point)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-bold text-slate-800 dark:text-white mb-4">Documents</h2>
            <div className="space-y-2">
              {offer.offer_letter_url && (
                <a
                  href={offer.offer_letter_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <FileText className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-white">Offer Letter</p>
                    <p className="text-xs text-slate-500">View or download</p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400" />
                </a>
              )}
              {offer.contract_url && (
                <a
                  href={offer.contract_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-white">Employment Contract</p>
                    <p className="text-xs text-slate-500">View or download</p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400" />
                </a>
              )}
              {!offer.offer_letter_url && !offer.contract_url && (
                <p className="text-sm text-slate-400 text-center py-4">No documents uploaded</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Offer Letter Preview Modal */}
      {showLetterPreview && offer.offer_letter_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-white">Offer Letter Preview</h3>
              <button
                onClick={() => setShowLetterPreview(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <iframe
                src={offer.offer_letter_url}
                className="w-full h-[600px] border border-slate-200 dark:border-slate-700 rounded-xl"
                title="Offer Letter Preview"
              />
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowLetterPreview(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Close
              </button>
              <a
                href={offer.offer_letter_url}
                download
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Counter Offer Form Modal */}
      {showCounterOfferForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">Record Counter Offer</h3>
              <button
                onClick={() => setShowCounterOfferForm(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Requested Base Salary
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    value={counterOffer.base_salary}
                    onChange={(e) => setCounterOffer({ ...counterOffer, base_salary: parseInt(e.target.value) || 0 })}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Current offer: {formatCurrency(offer.base_salary)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Requested Signing Bonus
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    value={counterOffer.signing_bonus}
                    onChange={(e) => setCounterOffer({ ...counterOffer, signing_bonus: parseInt(e.target.value) || 0 })}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Current offer: {formatCurrency(offer.signing_bonus)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={counterOffer.note}
                  onChange={(e) => setCounterOffer({ ...counterOffer, note: e.target.value })}
                  placeholder="Any additional details about the counter offer..."
                  rows={3}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>

              {offer.negotiation_guidance?.salary_flexibility && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">Flexibility Range</p>
                  <p className="text-sm text-amber-700 dark:text-amber-200">
                    {formatCurrency(offer.negotiation_guidance.salary_flexibility.min)} - {formatCurrency(offer.negotiation_guidance.salary_flexibility.max)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCounterOfferForm(false)}
                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCounterOffer}
                disabled={updatingStatus}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Record Counter Offer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {emailPreview.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <Mail className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">Email Preview</h3>
                  <p className="text-sm text-slate-500">Offer letter email</p>
                </div>
              </div>
              <button
                onClick={() => setEmailPreview({ show: false, loading: false, data: null })}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {emailPreview.loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : emailPreview.data ? (
                <div className="space-y-4">
                  {/* Email Headers */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-500 w-16">To:</span>
                      <span className="text-sm text-slate-800 dark:text-white">
                        {emailPreview.data.to_name} &lt;{emailPreview.data.to_email}&gt;
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-500 w-16">Subject:</span>
                      <span className="text-sm text-slate-800 dark:text-white font-medium">
                        {emailPreview.data.subject}
                      </span>
                    </div>
                  </div>

                  {/* Email Content */}
                  <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                    <div
                      className="bg-white p-4"
                      dangerouslySetInnerHTML={{ __html: emailPreview.data.html_content || "" }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-center text-slate-500">Failed to load email preview</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setEmailPreview({ show: false, loading: false, data: null })}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setEmailPreview({ show: false, loading: false, data: null });
                  handleSend();
                }}
                disabled={sending}
                className="flex items-center gap-2 px-5 py-2 bg-green-500 text-white rounded-xl font-medium shadow-lg shadow-green-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Offer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
