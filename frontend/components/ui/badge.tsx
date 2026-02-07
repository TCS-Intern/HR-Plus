import { cn } from "@/lib/utils";

const variants = {
  default: "bg-zinc-100 text-zinc-700",
  primary: "bg-accent-50 text-accent-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-rose-50 text-rose-700",
  info: "bg-blue-50 text-blue-700",
  purple: "bg-purple-50 text-purple-700",
} as const;

interface BadgeProps {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
  dot?: boolean;
}

export function Badge({ children, variant = "default", className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full", {
          "bg-zinc-500": variant === "default",
          "bg-accent-500": variant === "primary",
          "bg-emerald-500": variant === "success",
          "bg-amber-500": variant === "warning",
          "bg-rose-500": variant === "error",
          "bg-blue-500": variant === "info",
          "bg-purple-500": variant === "purple",
        })} />
      )}
      {children}
    </span>
  );
}
