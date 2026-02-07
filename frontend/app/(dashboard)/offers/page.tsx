"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  Eye,
  MessageSquare,
  FileText,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { offerApi } from "@/lib/api/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

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

const statusBadgeVariant: Record<string, { variant: "default" | "primary" | "success" | "warning" | "error" | "info" | "purple"; label: string; icon: any }> = {
  draft: { variant: "default", label: "Draft", icon: FileText },
  pending_approval: { variant: "warning", label: "Pending Approval", icon: Clock },
  approved: { variant: "info", label: "Approved", icon: CheckCircle },
  sent: { variant: "purple", label: "Sent", icon: Send },
  viewed: { variant: "info", label: "Viewed", icon: Eye },
  accepted: { variant: "success", label: "Accepted", icon: CheckCircle },
  rejected: { variant: "error", label: "Rejected", icon: XCircle },
  negotiating: { variant: "warning", label: "Negotiating", icon: MessageSquare },
  expired: { variant: "default", label: "Expired", icon: AlertTriangle },
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
      <div className="space-y-6">
        <PageHeader title="Offers" description="Manage candidate offers and negotiations" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Offers" description="Manage candidate offers and negotiations" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Stat
          label="Total"
          value={stats.total}
          icon={<DollarSign className="w-5 h-5" />}
          bgColor="bg-zinc-100"
        />
        <Stat
          label="Pending"
          value={stats.draft}
          icon={<FileText className="w-5 h-5" />}
          bgColor="bg-zinc-100"
        />
        <Stat
          label="Sent"
          value={stats.sent}
          icon={<Send className="w-5 h-5" />}
          bgColor="bg-purple-50"
        />
        <Stat
          label="Accepted"
          value={stats.accepted}
          icon={<CheckCircle className="w-5 h-5" />}
          bgColor="bg-emerald-50"
        />
        <Stat
          label="Negotiating"
          value={stats.negotiating}
          icon={<MessageSquare className="w-5 h-5" />}
          bgColor="bg-amber-50"
        />
        <Stat
          label="Rejected"
          value={stats.rejected}
          icon={<XCircle className="w-5 h-5" />}
          bgColor="bg-rose-50"
        />
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-zinc-900">
          All Offers ({filteredOffers.length})
        </h2>
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          options={[
            { value: "all", label: "All Status" },
            { value: "draft", label: "Draft" },
            { value: "approved", label: "Approved" },
            { value: "sent", label: "Sent" },
            { value: "accepted", label: "Accepted" },
            { value: "rejected", label: "Rejected" },
            { value: "negotiating", label: "Negotiating" },
          ]}
          className="w-40"
        />
      </div>

      {/* Offers List */}
      {filteredOffers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<DollarSign className="w-8 h-8" />}
            title="No offers yet"
            description="Offers will appear here when candidates are approved for hire."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOffers.map((offer) => {
            const statusCfg = statusBadgeVariant[offer.status] || statusBadgeVariant.draft;
            const StatusIcon = statusCfg.icon;
            const candidateName = offer.candidate
              ? `${offer.candidate.first_name} ${offer.candidate.last_name}`
              : "Unknown Candidate";

            return (
              <Card key={offer.id} hover padding="sm" className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar name={candidateName} size="lg" />
                    <div>
                      <h3 className="font-semibold text-zinc-900">
                        {candidateName}
                      </h3>
                      <p className="text-sm text-zinc-500">{offer.job?.title || "Unknown Position"}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant={statusCfg.variant}>
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </Badge>
                        <span className="text-sm font-semibold text-zinc-700">
                          {formatCurrency(offer.base_salary)}
                        </span>
                        {offer.signing_bonus > 0 && (
                          <span className="text-xs text-zinc-500">
                            + {formatCurrency(offer.signing_bonus)} signing
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(offer.status === "draft" || offer.status === "approved") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Send className="w-4 h-4" />}
                        onClick={() => handleSendOffer(offer.id)}
                      >
                        Send
                      </Button>
                    )}
                    <Link href={`/offers/${offer.id}`}>
                      <Button variant="secondary" size="sm" icon={<Eye className="w-4 h-4" />}>
                        View
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-200 text-xs text-zinc-500">
                  {offer.start_date && (
                    <span>Start: {format(new Date(offer.start_date), "MMM d, yyyy")}</span>
                  )}
                  {offer.offer_expiry_date && (
                    <span>Expires: {format(new Date(offer.offer_expiry_date), "MMM d, yyyy")}</span>
                  )}
                  <span>Created {formatDistanceToNow(new Date(offer.created_at))} ago</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
