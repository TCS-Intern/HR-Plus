"use client";

import { useState, useEffect } from "react";
import { Coins, Plus } from "lucide-react";
import { creditsApi } from "@/lib/api/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreditBalanceProps {
  showBuyButton?: boolean;
  className?: string;
}

export default function CreditBalance({ showBuyButton = true, className }: CreditBalanceProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBalance();
  }, []);

  const loadBalance = async () => {
    try {
      setIsLoading(true);
      const response = await creditsApi.getBalance();
      setBalance(response.credits || 0);
    } catch (error) {
      console.error("Error loading credit balance:", error);
      setBalance(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuyCredits = () => {
    // TODO: Implement credit purchase modal/flow
    toast.info("Credit purchase coming soon! Contact support for beta access.");
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="w-5 h-5 rounded-full bg-zinc-200 animate-pulse" />
        <div className="w-12 h-4 bg-zinc-200 rounded animate-pulse" />
      </div>
    );
  }

  const isLowBalance = balance !== null && balance < 3;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Balance Display */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg",
          isLowBalance
            ? "bg-amber-50 text-amber-600 border border-amber-200"
            : "bg-zinc-100 text-zinc-700"
        )}
      >
        <Coins className="w-4 h-4" />
        <span className="text-sm font-semibold">{balance ?? 0}</span>
        <span className="text-xs">credit{balance !== 1 ? "s" : ""}</span>
      </div>

      {/* Low Balance Warning */}
      {isLowBalance && (
        <span className="text-xs text-amber-600">
          Low balance
        </span>
      )}

      {/* Buy Button */}
      {showBuyButton && (
        <button
          onClick={handleBuyCredits}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Buy Credits
        </button>
      )}
    </div>
  );
}
