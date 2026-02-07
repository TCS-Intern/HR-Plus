import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="relative">
      {label && <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>}
      <div className="relative">
        <select
          className={cn(
            "w-full appearance-none bg-white border border-zinc-200 rounded-xl px-3 py-2 pr-8 text-sm text-zinc-700",
            "focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-zinc-400",
            "hover:border-zinc-300 transition-colors",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
      </div>
    </div>
  );
}
