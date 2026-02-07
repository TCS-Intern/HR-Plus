import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  bordered?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ children, className, hover, bordered, padding = "md", ...props }: CardProps) {
  const paddings = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div
      className={cn(
        "bg-white rounded-2xl shadow-sm",
        bordered && "border border-zinc-200",
        hover && "hover:shadow-md transition-all duration-200 cursor-pointer",
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <div>
        <h3 className="font-semibold text-zinc-900">{title}</h3>
        {description && <p className="text-sm text-zinc-500 mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}
