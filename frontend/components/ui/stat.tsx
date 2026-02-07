import { cn } from "@/lib/utils";
import Link from "next/link";

interface StatProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  bgColor?: string;
  accentColor?: string;
  href?: string;
  className?: string;
}

export function Stat({ label, value, icon, bgColor, accentColor, href, className }: StatProps) {
  const content = (
    <div
      className={cn(
        "rounded-2xl shadow-sm p-5",
        bgColor || "bg-white",
        !bgColor && accentColor && `border-l-4 ${accentColor}`,
        href && "hover:shadow-md transition-shadow cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{value}</p>
        </div>
        <div className="text-zinc-400">{icon}</div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
