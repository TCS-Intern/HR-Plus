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
  Mail,
} from "lucide-react";
import { cn, formatCurrency, formatShortDate } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { offerApi, emailApi } from "@/lib/api/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";

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

const statusBadgeConfig: Record<string, { variant: "default" | "primary" | "success" | "warning" | "error" | "info" | "purple"; label: string; icon: React.ReactNode }> = {
  draft: { variant: "default", label: "Draft", icon: <Circle className="w-3.5 h-3.5" /> },
  pending_approval: { variant: "warning", label: "Pending Approval", icon: <Clock className="w-3.5 h-3.5" /> },
  approved: { variant: "info", label: "Approved", icon: <Check className="w-3.5 h-3.5" /> },
  sent: { variant: "purple", label: "Sent", icon: <Send className="w-3.5 h-3.5" /> },
  viewed: { variant: "info", label: "Viewed", icon: <Eye className="w-3.5 h-3.5" /> },
  accepted: { variant: "success", label: "Accepted", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  rejected: { variant: "error", label: "Rejected", icon: <XCircle className="w-3.5 h-3.5" /> },
  negotiating: { variant: "warning", label: "Negotiating", icon: <MessageSquare className="w-3.5 h-3.5" /> },
  expired: { variant: "default", label: "Expired", icon: <Clock className="w-3.5 h-3.5" /> },
};

const timelineStatusColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: "bg-zinc-100", text: "text-zinc-600" },
  pending_approval: { bg: "bg-amber-100", text: "text-amber-600" },
  approved: { bg: "bg-blue-100", text: "text-blue-600" },
  sent: { bg: "bg-purple-100", text: "text-purple-600" },
  viewed: { bg: "bg-indigo-100", text: "text-indigo-600" },
  accepted: { bg: "bg-emerald-100", text: "text-emerald-600" },
  rejected: { bg: "bg-rose-100", text: "text-rose-600" },
  negotiating: { bg: "bg-amber-100", text: "text-amber-600" },
  expired: { bg: "bg-zinc-100", text: "text-zinc-600" },
};

const timelineIcons: Record<string, React.ReactNode> = {
  draft: <Circle className="w-4 h-4" />,
  pending_approval: <Clock className="w-4 h-4" />,
  approved: <Check className="w-4 h-4" />,
  sent: <Send className="w-4 h-4" />,
  viewed: <Eye className="w-4 h-4" />,
  accepted: <CheckCircle className="w-4 h-4" />,
  rejected: <XCircle className="w-4 h-4" />,
  negotiating: <MessageSquare className="w-4 h-4" />,
  expired: <Clock className="w-4 h-4" />,
};

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
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Offer not found</h2>
        <Link href="/offers" className="text-accent hover:underline">
          Back to offers
        </Link>
      </div>
    );
  }

  const statusCfg = statusBadgeConfig[offer.status] || statusBadgeConfig.draft;
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
            className="p-2 bg-white rounded-lg border border-zinc-200 text-zinc-600 hover:text-accent hover:border-zinc-300 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-zinc-900">
                Offer for {candidate ? `${candidate.first_name} ${candidate.last_name}` : "Candidate"}
              </h1>
              <Badge variant={statusCfg.variant}>
                {statusCfg.icon}
                {statusCfg.label}
              </Badge>
            </div>
            <p className="text-sm text-zinc-500">{job?.title || "Position"} {job?.department ? `- ${job.department}` : ""}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {offer.offer_letter_url && (
            <Button variant="secondary" icon={<Eye className="w-4 h-4" />} onClick={() => setShowLetterPreview(true)}>
              Preview Letter
            </Button>
          )}

          {offer.status === "draft" && (
            <Button
              onClick={handleApprove}
              loading={updatingStatus}
              icon={<Check className="w-4 h-4" />}
            >
              Approve
            </Button>
          )}

          {offer.status === "approved" && (
            <>
              <Button
                variant="secondary"
                onClick={handlePreviewOfferEmail}
                loading={emailPreview.loading}
                icon={<Mail className="w-4 h-4" />}
              >
                Preview Email
              </Button>
              <Button
                onClick={handleSend}
                loading={sending}
                icon={<Send className="w-4 h-4" />}
              >
                Send Offer
              </Button>
            </>
          )}

          {(offer.status === "sent" || offer.status === "viewed") && (
            <>
              <Button
                variant="success"
                onClick={() => handleUpdateStatus("accepted")}
                loading={updatingStatus}
                icon={<CheckCircle className="w-4 h-4" />}
              >
                Mark Accepted
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowCounterOfferForm(true)}
                icon={<MessageSquare className="w-4 h-4" />}
              >
                Counter Offer
              </Button>
              <Button
                variant="danger"
                onClick={() => handleUpdateStatus("rejected")}
                loading={updatingStatus}
                icon={<XCircle className="w-4 h-4" />}
              >
                Mark Rejected
              </Button>
              <Button
                variant="secondary"
                onClick={handleWithdraw}
                loading={updatingStatus}
                icon={<RotateCcw className="w-4 h-4" />}
              >
                Withdraw
              </Button>
            </>
          )}

          {offer.status === "negotiating" && (
            <>
              <Button
                variant="success"
                onClick={handleAcceptCounterOffer}
                loading={updatingStatus}
                icon={<CheckCircle className="w-4 h-4" />}
              >
                Accept Counter Terms
              </Button>
              <Button
                onClick={() => handleUpdateStatus("sent")}
                loading={updatingStatus}
                icon={<Send className="w-4 h-4" />}
              >
                Send Updated Offer
              </Button>
              <Button
                variant="danger"
                onClick={() => handleUpdateStatus("rejected")}
                loading={updatingStatus}
                icon={<XCircle className="w-4 h-4" />}
              >
                Decline
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <Card>
        <CardHeader title="Status Timeline" />
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {timelineEvents.map((event, index) => {
            const colors = timelineStatusColors[event.status] || timelineStatusColors.draft;
            return (
              <div key={index} className="flex items-center">
                <div className="flex flex-col items-center min-w-[100px]">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", colors.bg, colors.text)}>
                    {timelineIcons[event.status]}
                  </div>
                  <p className="text-xs font-medium text-zinc-700 mt-2">{event.label}</p>
                  <p className="text-xs text-zinc-500">{formatShortDate(event.date)}</p>
                </div>
                {index < timelineEvents.length - 1 && (
                  <div className="flex-1 h-0.5 bg-zinc-200 min-w-[40px] mx-2" />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Compensation */}
          <Card>
            <CardHeader title="Compensation Package" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-primary/5 rounded-lg p-4 text-center">
                <p className="text-xs text-zinc-500 mb-1">Base Salary</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(offer.base_salary, offer.currency)}</p>
                <p className="text-xs text-zinc-500">per year</p>
              </div>
              {offer.signing_bonus > 0 && (
                <div className="bg-emerald-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-zinc-500 mb-1">Signing Bonus</p>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(offer.signing_bonus, offer.currency)}</p>
                  <p className="text-xs text-zinc-500">one-time</p>
                </div>
              )}
              {offer.annual_bonus_target && (
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-zinc-500 mb-1">Target Bonus</p>
                  <p className="text-xl font-bold text-amber-600">{offer.annual_bonus_target}%</p>
                  <p className="text-xs text-zinc-500">of base</p>
                </div>
              )}
              {offer.equity_type && offer.equity_type !== "none" && (
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-zinc-500 mb-1">Equity</p>
                  <p className="text-xl font-bold text-purple-600">
                    {offer.equity_amount?.toLocaleString()} {offer.equity_type?.toUpperCase()}
                  </p>
                  <p className="text-xs text-zinc-500">{offer.equity_vesting_schedule || "4-year vest"}</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Total First Year Compensation (Est.)</span>
                <span className="text-2xl font-bold text-zinc-900">
                  {formatCurrency(totalCompensation, offer.currency)}
                </span>
              </div>
            </div>
          </Card>

          {/* Benefits */}
          {offer.benefits && offer.benefits.length > 0 && (
            <Card>
              <CardHeader title="Benefits" />
              <div className="grid md:grid-cols-2 gap-4">
                {offer.benefits.map((benefit, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Gift className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900 text-sm">
                        {benefit.benefit_type}
                      </p>
                      <p className="text-xs text-zinc-500">{benefit.description}</p>
                      {benefit.value_estimate && (
                        <p className="text-xs text-primary mt-1">
                          Est. value: {formatCurrency(benefit.value_estimate)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Contingencies */}
          {offer.contingencies && offer.contingencies.length > 0 && (
            <Card>
              <CardHeader title="Contingencies" />
              <ul className="space-y-2">
                {offer.contingencies.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Negotiation Notes */}
          <Card>
            <CardHeader
              title="Comments & Notes"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setShowNegotiationForm(!showNegotiationForm)}
                >
                  Add Note
                </Button>
              }
            />

            {showNegotiationForm && (
              <div className="mb-4 p-4 bg-zinc-50 rounded-lg">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note about this offer or negotiation..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-zinc-300 focus:border-transparent resize-none mb-3"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddNote}
                    loading={addingNote}
                    disabled={!newNote.trim()}
                    size="sm"
                  >
                    Save Note
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setShowNegotiationForm(false);
                      setNewNote("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {offer.negotiation_notes && offer.negotiation_notes.length > 0 ? (
              <div className="space-y-3">
                {offer.negotiation_notes.map((note, i) => (
                  <div key={i} className="p-3 bg-zinc-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={note.actor === "Candidate" ? "info" : "default"}>
                        {note.actor}
                      </Badge>
                      <span className="text-xs text-zinc-400">
                        {format(new Date(note.timestamp), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-700">{note.note}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 text-center py-4">No notes yet</p>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Candidate Info */}
          {candidate && (
            <Card>
              <CardHeader title="Candidate" />
              <div className="flex items-center gap-4 mb-4">
                <Avatar name={`${candidate.first_name} ${candidate.last_name}`} size="lg" />
                <div>
                  <p className="font-semibold text-zinc-900">
                    {candidate.first_name} {candidate.last_name}
                  </p>
                  <p className="text-sm text-zinc-500">{candidate.email}</p>
                </div>
              </div>
              {candidate.phone && (
                <p className="text-sm text-zinc-700">Phone: {candidate.phone}</p>
              )}
            </Card>
          )}

          {/* Key Dates */}
          <Card>
            <CardHeader title="Key Dates" />
            <div className="space-y-4">
              {offer.start_date && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Proposed Start Date</p>
                    <p className="text-sm font-medium text-zinc-900">
                      {format(new Date(offer.start_date), "MMMM d, yyyy")}
                    </p>
                  </div>
                </div>
              )}
              {offer.offer_expiry_date && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Offer Expires</p>
                    <p className="text-sm font-medium text-zinc-900">
                      {format(new Date(offer.offer_expiry_date), "MMMM d, yyyy")}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-zinc-500" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Created</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {formatDistanceToNow(new Date(offer.created_at))} ago
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Negotiation Guidance */}
          {offer.negotiation_guidance && (
            <Card>
              <CardHeader title="Negotiation Guidance" />
              {offer.negotiation_guidance.salary_flexibility && (
                <div className="mb-4">
                  <p className="text-xs text-zinc-500 mb-1">Salary Flexibility</p>
                  <p className="text-sm text-zinc-700">
                    {formatCurrency(offer.negotiation_guidance.salary_flexibility.min)} -{" "}
                    {formatCurrency(offer.negotiation_guidance.salary_flexibility.max)}
                  </p>
                </div>
              )}
              {offer.negotiation_guidance.other_levers &&
                offer.negotiation_guidance.other_levers.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-zinc-500 mb-2">Other Levers</p>
                    <ul className="space-y-1">
                      {offer.negotiation_guidance.other_levers.map((lever, i) => (
                        <li key={i} className="text-xs text-zinc-700 flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-primary" />
                          {lever}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              {offer.negotiation_guidance.walk_away_point && (
                <div className="pt-3 border-t border-zinc-200">
                  <p className="text-xs text-rose-500 mb-1">Walk Away Point</p>
                  <p className="text-sm text-zinc-700">
                    {formatCurrency(offer.negotiation_guidance.walk_away_point)}
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Documents */}
          <Card>
            <CardHeader title="Documents" />
            <div className="space-y-2">
              {offer.offer_letter_url && (
                <a
                  href={offer.offer_letter_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors"
                >
                  <FileText className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-900">Offer Letter</p>
                    <p className="text-xs text-zinc-500">View or download</p>
                  </div>
                  <Download className="w-4 h-4 text-zinc-400" />
                </a>
              )}
              {offer.contract_url && (
                <a
                  href={offer.contract_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors"
                >
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-900">Employment Contract</p>
                    <p className="text-xs text-zinc-500">View or download</p>
                  </div>
                  <Download className="w-4 h-4 text-zinc-400" />
                </a>
              )}
              {!offer.offer_letter_url && !offer.contract_url && (
                <p className="text-sm text-zinc-400 text-center py-4">No documents uploaded</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Offer Letter Preview Modal */}
      <Modal
        isOpen={showLetterPreview && !!offer.offer_letter_url}
        onClose={() => setShowLetterPreview(false)}
        title="Offer Letter Preview"
        size="xl"
      >
        <div className="p-6">
          <iframe
            src={offer.offer_letter_url || ""}
            className="w-full h-[600px] border border-zinc-200 rounded-lg"
            title="Offer Letter Preview"
          />
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-200">
          <Button variant="secondary" onClick={() => setShowLetterPreview(false)}>
            Close
          </Button>
          <a href={offer.offer_letter_url || ""} download>
            <Button icon={<Download className="w-4 h-4" />}>
              Download
            </Button>
          </a>
        </div>
      </Modal>

      {/* Counter Offer Form Modal */}
      <Modal
        isOpen={showCounterOfferForm}
        onClose={() => setShowCounterOfferForm(false)}
        title="Record Counter Offer"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Requested Base Salary
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="number"
                value={counterOffer.base_salary}
                onChange={(e) => setCounterOffer({ ...counterOffer, base_salary: parseInt(e.target.value) || 0 })}
                className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-zinc-300 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Current offer: {formatCurrency(offer.base_salary)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Requested Signing Bonus
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="number"
                value={counterOffer.signing_bonus}
                onChange={(e) => setCounterOffer({ ...counterOffer, signing_bonus: parseInt(e.target.value) || 0 })}
                className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-zinc-300 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Current offer: {formatCurrency(offer.signing_bonus)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Notes
            </label>
            <textarea
              value={counterOffer.note}
              onChange={(e) => setCounterOffer({ ...counterOffer, note: e.target.value })}
              placeholder="Any additional details about the counter offer..."
              rows={3}
              className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-zinc-300 focus:border-transparent resize-none"
            />
          </div>

          {offer.negotiation_guidance?.salary_flexibility && (
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-xs text-amber-700 font-medium">Flexibility Range</p>
              <p className="text-sm text-amber-600">
                {formatCurrency(offer.negotiation_guidance.salary_flexibility.min)} - {formatCurrency(offer.negotiation_guidance.salary_flexibility.max)}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-zinc-200">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setShowCounterOfferForm(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmitCounterOffer}
            loading={updatingStatus}
          >
            Record Counter Offer
          </Button>
        </div>
      </Modal>

      {/* Email Preview Modal */}
      <Modal
        isOpen={emailPreview.show}
        onClose={() => setEmailPreview({ show: false, loading: false, data: null })}
        title="Email Preview"
        description="Offer letter email"
        size="lg"
      >
        <div className="p-6">
          {emailPreview.loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : emailPreview.data ? (
            <div className="space-y-4">
              <div className="bg-zinc-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-500 w-16">To:</span>
                  <span className="text-sm text-zinc-900">
                    {emailPreview.data.to_name} &lt;{emailPreview.data.to_email}&gt;
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-500 w-16">Subject:</span>
                  <span className="text-sm text-zinc-900 font-medium">
                    {emailPreview.data.subject}
                  </span>
                </div>
              </div>

              <div className="border border-zinc-200 rounded-lg overflow-hidden">
                <div
                  className="bg-white p-4"
                  dangerouslySetInnerHTML={{ __html: emailPreview.data.html_content || "" }}
                />
              </div>
            </div>
          ) : (
            <p className="text-center text-zinc-500">Failed to load email preview</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-200 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setEmailPreview({ show: false, loading: false, data: null })}
          >
            Close
          </Button>
          <Button
            variant="success"
            icon={<Send className="w-4 h-4" />}
            onClick={() => {
              setEmailPreview({ show: false, loading: false, data: null });
              handleSend();
            }}
            loading={sending}
          >
            Send Offer
          </Button>
        </div>
      </Modal>
    </div>
  );
}
