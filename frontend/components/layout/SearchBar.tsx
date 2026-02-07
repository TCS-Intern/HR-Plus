"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  X,
  Briefcase,
  Users,
  Mail,
  Phone,
  FileText,
  Target,
  ArrowRight,
  Command,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";

interface SearchResult {
  id: string;
  type: "job" | "candidate" | "sourced" | "campaign" | "phone_screen" | "offer";
  title: string;
  subtitle: string;
  url: string;
  status?: string;
}

interface SearchCategory {
  type: SearchResult["type"];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const categories: SearchCategory[] = [
  { type: "job", label: "Jobs", icon: Briefcase, color: "text-blue-600 bg-blue-50" },
  { type: "candidate", label: "Candidates", icon: Users, color: "text-emerald-600 bg-emerald-50" },
  { type: "sourced", label: "Sourced", icon: Target, color: "text-purple-600 bg-purple-50" },
  { type: "campaign", label: "Campaigns", icon: Mail, color: "text-amber-600 bg-amber-50" },
  { type: "phone_screen", label: "Phone Screens", icon: Phone, color: "text-indigo-600 bg-indigo-50" },
  { type: "offer", label: "Offers", icon: FileText, color: "text-emerald-600 bg-emerald-50" },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function SearchBar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<SearchResult["type"] | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups: Record<SearchResult["type"], SearchResult[]> = {
      job: [],
      candidate: [],
      sourced: [],
      campaign: [],
      phone_screen: [],
      offer: [],
    };

    results.forEach((result) => {
      groups[result.type].push(result);
    });

    return groups;
  }, [results]);

  // Filter results by selected category
  const filteredResults = useMemo(() => {
    if (!selectedCategory) return results;
    return results.filter((r) => r.type === selectedCategory);
  }, [results, selectedCategory]);

  // Flatten for keyboard navigation
  const flatResults = useMemo(() => {
    return filteredResults;
  }, [filteredResults]);

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);

    try {
      const searchResults: SearchResult[] = [];
      const searchTerm = `%${searchQuery}%`;

      // Search jobs
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, title, department, status")
        .or(`title.ilike.${searchTerm},department.ilike.${searchTerm}`)
        .limit(5);

      if (jobs) {
        jobs.forEach((job) => {
          searchResults.push({
            id: job.id,
            type: "job",
            title: job.title,
            subtitle: job.department,
            url: `/jobs/${job.id}`,
            status: job.status,
          });
        });
      }

      // Search candidates
      const { data: candidates } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, email")
        .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
        .limit(5);

      if (candidates) {
        candidates.forEach((candidate) => {
          searchResults.push({
            id: candidate.id,
            type: "candidate",
            title: `${candidate.first_name} ${candidate.last_name}`,
            subtitle: candidate.email,
            url: `/candidates/${candidate.id}`,
          });
        });
      }

      // Search sourced candidates
      const { data: sourced } = await supabase
        .from("sourced_candidates")
        .select("id, first_name, last_name, current_company, status")
        .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},current_company.ilike.${searchTerm}`)
        .limit(5);

      if (sourced) {
        sourced.forEach((s) => {
          searchResults.push({
            id: s.id,
            type: "sourced",
            title: `${s.first_name} ${s.last_name}`,
            subtitle: s.current_company || "Sourced Candidate",
            url: `/sourcing/${s.id}`,
            status: s.status,
          });
        });
      }

      // Search campaigns
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id, name, status")
        .ilike("name", searchTerm)
        .limit(5);

      if (campaigns) {
        campaigns.forEach((campaign) => {
          searchResults.push({
            id: campaign.id,
            type: "campaign",
            title: campaign.name,
            subtitle: `${campaign.status} campaign`,
            url: `/campaigns/${campaign.id}`,
            status: campaign.status,
          });
        });
      }

      // Search phone screens
      const { data: phoneScreens } = await supabase
        .from("phone_screens")
        .select("id, status, sourced_candidates(first_name, last_name)")
        .limit(5);

      if (phoneScreens) {
        phoneScreens.forEach((ps: any) => {
          if (ps.sourced_candidates) {
            const name = `${ps.sourced_candidates.first_name} ${ps.sourced_candidates.last_name}`;
            if (name.toLowerCase().includes(searchQuery.toLowerCase())) {
              searchResults.push({
                id: ps.id,
                type: "phone_screen",
                title: `Phone Screen: ${name}`,
                subtitle: `Status: ${ps.status}`,
                url: `/phone-screens/${ps.id}`,
                status: ps.status,
              });
            }
          }
        });
      }

      // Search offers
      const { data: offers } = await supabase
        .from("offers")
        .select("id, status, candidates(first_name, last_name)")
        .limit(5);

      if (offers) {
        offers.forEach((offer: any) => {
          if (offer.candidates) {
            const name = `${offer.candidates.first_name} ${offer.candidates.last_name}`;
            if (name.toLowerCase().includes(searchQuery.toLowerCase())) {
              searchResults.push({
                id: offer.id,
                type: "offer",
                title: `Offer: ${name}`,
                subtitle: `Status: ${offer.status}`,
                url: `/offers/${offer.id}`,
                status: offer.status,
              });
            }
          }
        });
      }

      setResults(searchResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }

      // Close with Escape
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setQuery("");
        setResults([]);
        setSelectedCategory(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Keyboard navigation within results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (flatResults[selectedIndex]) {
          router.push(flatResults[selectedIndex].url);
          setIsOpen(false);
          setQuery("");
          setResults([]);
        }
        break;
      case "Tab":
        // Cycle through categories
        e.preventDefault();
        const currentCatIndex = selectedCategory
          ? categories.findIndex((c) => c.type === selectedCategory)
          : -1;
        const nextIndex = (currentCatIndex + 1) % (categories.length + 1);
        setSelectedCategory(nextIndex === categories.length ? null : categories[nextIndex].type);
        setSelectedIndex(0);
        break;
    }
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Search Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 transition-all"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm hidden sm:block">Search...</span>
        <kbd className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-zinc-100 rounded text-xs text-zinc-500">
          <Command className="w-3 h-3" />K
        </kbd>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setIsOpen(false);
              setQuery("");
              setResults([]);
              setSelectedCategory(null);
            }}
          />

          {/* Search Container */}
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-lg border border-zinc-200 overflow-hidden">
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200">
              <Search className="w-5 h-5 text-zinc-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search jobs, candidates, campaigns..."
                className="flex-1 bg-transparent text-zinc-800 placeholder-zinc-400 outline-none text-base"
                autoComplete="off"
              />
              {loading && <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />}
              {query && !loading && (
                <button
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                    inputRef.current?.focus();
                  }}
                  className="p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            {results.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-200 overflow-x-auto">
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedIndex(0);
                  }}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                    !selectedCategory
                      ? "bg-primary text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  )}
                >
                  All ({results.length})
                </button>
                {categories.map((category) => {
                  const count = groupedResults[category.type].length;
                  if (count === 0) return null;
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.type}
                      onClick={() => {
                        setSelectedCategory(category.type);
                        setSelectedIndex(0);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors",
                        selectedCategory === category.type
                          ? "bg-primary text-white"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {category.label} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {filteredResults.length > 0 ? (
                <div className="py-2">
                  {filteredResults.map((result, index) => {
                    const category = categories.find((c) => c.type === result.type);
                    const Icon = category?.icon || Briefcase;
                    const colorClass = category?.color || "text-zinc-600 bg-zinc-100";

                    return (
                      <Link
                        key={`${result.type}-${result.id}`}
                        href={result.url}
                        onClick={() => {
                          setIsOpen(false);
                          setQuery("");
                          setResults([]);
                        }}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors",
                          selectedIndex === index && "bg-zinc-50"
                        )}
                      >
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                            colorClass.split(" ")[1]
                          )}
                        >
                          <Icon className={cn("w-5 h-5", colorClass.split(" ")[0])} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-zinc-900 truncate">
                            {result.title}
                          </div>
                          <div className="text-sm text-zinc-500 truncate">{result.subtitle}</div>
                        </div>
                        {result.status && (
                          <span className="px-2 py-1 bg-zinc-100 text-zinc-500 text-xs rounded-lg">
                            {result.status}
                          </span>
                        )}
                        <ArrowRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              ) : query && !loading ? (
                <div className="py-12 text-center">
                  <Search className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                  <p className="text-zinc-500">No results found for &quot;{query}&quot;</p>
                  <p className="text-sm text-zinc-400 mt-1">Try different keywords</p>
                </div>
              ) : !query ? (
                <div className="py-8 px-4">
                  <p className="text-sm text-zinc-500 mb-4">Quick Links</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "All Jobs", url: "/jobs", icon: Briefcase },
                      { label: "Candidates", url: "/candidates", icon: Users },
                      { label: "Campaigns", url: "/campaigns", icon: Mail },
                      { label: "Phone Screens", url: "/phone-screens", icon: Phone },
                    ].map((link) => (
                      <Link
                        key={link.url}
                        href={link.url}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 p-3 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors"
                      >
                        <link.icon className="w-4 h-4 text-zinc-500" />
                        <span className="text-sm text-zinc-700">{link.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 bg-zinc-50">
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-zinc-200">
                    &uarr;
                  </kbd>
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-zinc-200">
                    &darr;
                  </kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-zinc-200">
                    Enter
                  </kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-zinc-200">
                    Tab
                  </kbd>
                  Categories
                </span>
              </div>
              <span className="text-xs text-zinc-400">
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-zinc-200">
                  Esc
                </kbd>{" "}
                to close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
