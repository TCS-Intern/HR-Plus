"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Send,
  Eye,
  Filter,
  ChevronDown,
  MessageSquare,
  FileText,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { offerApi } from "@/lib/api/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

interface Offer {
  id: string;
  application_id: string;
  base_salary: number;
  currency: string;
  signing_bonus: number;
  annual_bonus_target: number | null;
  equity_type: string | null;
  equity_amount: number | null;
  start_date: string | null;
  offer_expiry_date: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
  responded_at: string | null;
  candidate?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  job?: {
    title: string;
    department: string | null;
  };
}

type FilterStatus = "all" | "draft" | "approved" | "sent" | "accepted" | "rejected" | "negotiating";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-600", icon: FileText },
  pending_approval: { label: "Pending Approval", color: "bg-amber-100 text-amber-600", icon: Clock },
  approved: { label: "Approved", color: "bg-blue-100 text-blue-600", icon: CheckCircle },
  sent: { label: "Sent", color: "bg-purple-100 text-purple-600", icon: Send },
  viewed: { label: "Viewed", color: "bg-indigo-100 text-indigo-600", icon: Eye },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-600", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-600", icon: XCircle },
  negotiating: { label: "Negotiating", color: "bg-orange-100 text-orange-600", icon: MessageSquare },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-600", icon: AlertTriangle },
};

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      const { data, error } = await supabase
        .from("offers")
        .select(`
          *,
          applications (
            *,
            candidates (*),
            jobs (*)
          )
        `)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const transformedData = data.map((item: any) => ({
          ...item,
          candidate: item.applications?.candidates,
          job: item.applications?.jobs,
        }));
        setOffers(transformedData);
      }
    } catch (error) {
      console.error("Error fetching offers:", error);
    }
    setLoading(false);
  };

  const handleSendOffer = async (offerId: string) => {
    try {
      await offerApi.send(offerId);
      toast.success("Offer sent to candidate!");
      fetchOffers();
    } catch (error) {
      console.error("Error sending offer:", error);
      toast.error("Failed to send offer");
    }
  };

  const filteredOffers = offers.filter((o) => {
    if (filterStatus === "all") return true;
    return o.status === filterStatus;
  });

  const stats = {
    total: offers.length,
    draft: offers.filter((o) => o.status === "draft" || o.status === "approved").length,
    sent: offers.filter((o) => o.status === "sent" || o.status === "viewed").length,
    accepted: offers.filter((o) => o.status === "accepted").length,
    negotiating: offers.filter((o) => o.status === "negotiating").length,
    rejected: offers.filter((o) => o.status === "rejected").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Offers</h1>
          <p className="text-sm text-slate-500">Manage candidate offers and negotiations</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.draft}</p>
              <p className="text-xs text-slate-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-xl flex items-center justify-center">
              <Send className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.sent}</p>
              <p className="text-xs text-slate-500">Sent</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.accepted}</p>
              <p className="text-xs text-slate-500">Accepted</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/40 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.negotiating}</p>
              <p className="text-xs text-slate-500">Negotiating</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-xl flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.rejected}</p>
              <p className="text-xs text-slate-500">Rejected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-800 dark:text-white">
          All Offers ({filteredOffers.length})
        </h2>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="appearance-none pl-10 pr-10 py-2 bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="negotiating">Negotiating</option>
          </select>
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* Offers List */}
      {filteredOffers.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center">
          <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-800 dark:text-white mb-2">No offers yet</h3>
          <p className="text-sm text-slate-500">
            Offers will appear here when candidates are approved for hire.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOffers.map((offer) => {
            const status = statusConfig[offer.status] || statusConfig.draft;
            const StatusIcon = status.icon;

            return (
              <div key={offer.id} className="glass-card rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">
                        {offer.candidate?.first_name?.charAt(0) || "?"}
                      </span>
                    </div>

                    {/* Info */}
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-white">
                        {offer.candidate
                          ? `${offer.candidate.first_name} ${offer.candidate.last_name}`
                          : "Unknown Candidate"}
                      </h3>
                      <p className="text-sm text-slate-500">{offer.job?.title || "Unknown Position"}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={cn("px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1", status.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {formatCurrency(offer.base_salary)}
                        </span>
                        {offer.signing_bonus > 0 && (
                          <span className="text-xs text-slate-500">
                            + {formatCurrency(offer.signing_bonus)} signing
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {(offer.status === "draft" || offer.status === "approved") && (
                      <button
                        onClick={() => handleSendOffer(offer.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        Send
                      </button>
                    )}
                    <Link
                      href={`/offers/${offer.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Link>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 text-xs text-slate-500">
                  {offer.start_date && (
                    <span>Start: {format(new Date(offer.start_date), "MMM d, yyyy")}</span>
                  )}
                  {offer.offer_expiry_date && (
                    <span>Expires: {format(new Date(offer.offer_expiry_date), "MMM d, yyyy")}</span>
                  )}
                  <span>Created {formatDistanceToNow(new Date(offer.created_at))} ago</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
