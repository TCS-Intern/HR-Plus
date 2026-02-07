import { cn } from "@/lib/utils";

const sizes = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-14 h-14 text-lg",
} as const;

interface AvatarProps {
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}

export function Avatar({ name, size = "md", className }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center text-white font-semibold flex-shrink-0",
        sizes[size],
        className
      )}
    >
      {initials || "?"}
    </div>
  );
}
