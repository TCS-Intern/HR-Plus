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
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { offerApi } from "@/lib/api/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

interface Benefit {
  benefit_type: string;
  description: string;
  value_estimate: number | null;
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
  contingencies: string[];
  negotiation_notes: any[];
  negotiation_guidance: any;
  status: string;
  created_at: string;
  sent_at: string | null;
  responded_at: string | null;
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
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: "Draft", color: "text-slate-600", bgColor: "bg-slate-100" },
  approved: { label: "Approved", color: "text-blue-600", bgColor: "bg-blue-100" },
  sent: { label: "Sent", color: "text-purple-600", bgColor: "bg-purple-100" },
  viewed: { label: "Viewed", color: "text-indigo-600", bgColor: "bg-indigo-100" },
  accepted: { label: "Accepted", color: "text-green-600", bgColor: "bg-green-100" },
  rejected: { label: "Rejected", color: "text-red-600", bgColor: "bg-red-100" },
  negotiating: { label: "Negotiating", color: "text-orange-600", bgColor: "bg-orange-100" },
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

  const handleSend = async () => {
    setSending(true);
    try {
      await offerApi.send(offerId);
      toast.success("Offer sent to candidate!");
      // Refresh offer data
      const { data } = await supabase.from("offers").select("*").eq("id", offerId).single();
      if (data) setOffer(data);
    } catch (error) {
      console.error("Error sending offer:", error);
      toast.error("Failed to send offer");
    }
    setSending(false);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await offerApi.updateStatus(offerId, newStatus);
      toast.success(`Offer marked as ${newStatus}`);
      // Refresh offer data
      const { data } = await supabase.from("offers").select("*").eq("id", offerId).single();
      if (data) setOffer(data);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
    setUpdatingStatus(false);
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
              <span className={cn("px-3 py-1 text-xs font-semibold rounded-full", status.bgColor, status.color)}>
                {status.label}
              </span>
            </div>
            <p className="text-sm text-slate-500">{job?.title || "Position"}</p>
          </div>
        </div>

        <div className="flex gap-3">
          {(offer.status === "draft" || offer.status === "approved") && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Offer
            </button>
          )}
          {offer.status === "sent" && (
            <div className="flex gap-2">
              <button
                onClick={() => handleUpdateStatus("accepted")}
                disabled={updatingStatus}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl font-medium hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Mark Accepted
              </button>
              <button
                onClick={() => handleUpdateStatus("negotiating")}
                disabled={updatingStatus}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl font-medium hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                <MessageSquare className="w-4 h-4" />
                Negotiating
              </button>
              <button
                onClick={() => handleUpdateStatus("rejected")}
                disabled={updatingStatus}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Mark Rejected
              </button>
            </div>
          )}
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
                <p className="text-xl font-bold text-primary">{formatCurrency(offer.base_salary)}</p>
                <p className="text-xs text-slate-500">per year</p>
              </div>
              {offer.signing_bonus > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Signing Bonus</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(offer.signing_bonus)}</p>
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
                  {formatCurrency(totalCompensation)}
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
          {offer.negotiation_notes && offer.negotiation_notes.length > 0 && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">Negotiation Notes</h2>
              <div className="space-y-3">
                {offer.negotiation_notes.map((note: any, i: number) => (
                  <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500">{note.actor}</span>
                      <span className="text-xs text-slate-400">
                        {format(new Date(note.timestamp), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{note.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                <p className="text-sm text-slate-600 dark:text-slate-400">📞 {candidate.phone}</p>
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
                      {offer.negotiation_guidance.other_levers.map((lever: string, i: number) => (
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
                    {offer.negotiation_guidance.walk_away_point}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
