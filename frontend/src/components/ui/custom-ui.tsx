import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

type BadgeStatus =
  | "pending" | "active" | "completed" | "resolved" | "critical" | "inactive"
  | "dispensed" | "processing" | "low" | "available"
  | "partially_dispensed" | "cancelled";

const statusStyles: Record<BadgeStatus, string> = {
  pending:              "bg-warning/15 text-warning-foreground border-warning/30",
  active:               "bg-primary/10 text-primary border-primary/30",
  completed:            "bg-success/15 text-success border-success/30",
  resolved:             "bg-success/15 text-success border-success/30",
  critical:             "bg-destructive/10 text-destructive border-destructive/30",
  inactive:             "bg-muted text-muted-foreground border-border",
  dispensed:            "bg-success/15 text-success border-success/30",
  processing:           "bg-primary/10 text-primary border-primary/30",
  low:                  "bg-warning/15 text-warning-foreground border-warning/30",
  available:            "bg-success/15 text-success border-success/30",
  partially_dispensed:  "bg-primary/10 text-primary border-primary/30",
  cancelled:            "bg-muted text-muted-foreground border-border",
};

const STATUS_LABELS: Partial<Record<BadgeStatus, string>> = {
  partially_dispensed: "Partial",
};

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status as BadgeStatus] ?? statusStyles.pending;
  const label = STATUS_LABELS[status as BadgeStatus] ?? status.replace(/_/g, " ");
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border capitalize", style)}>
      {label}
    </span>
  );
}

export function StatCard({ icon: Icon, label, value, tint = "primary" }: { icon: LucideIcon; label: string; value: string | number; tint?: "primary" | "accent" | "destructive" | "success" }) {
  const tintStyles = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    destructive: "bg-destructive/10 text-destructive",
    success: "bg-success/10 text-success",
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-card">
      <div className="flex items-center gap-4">
        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", tintStyles[tint])}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-2xl font-heading font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-heading font-bold text-foreground">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, message, action }: { icon: LucideIcon; message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground mb-4">{message}</p>
      {action}
    </div>
  );
}

export function AvatarCircle({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };
  return (
    <div className={cn("rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-heading font-bold", sizes[size])}>
      {initials}
    </div>
  );
}
