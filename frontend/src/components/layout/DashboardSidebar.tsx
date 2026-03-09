import { cn } from "@/lib/utils";
import { NavLink as RouterNavLink, useLocation, Link } from "react-router-dom";
import { type LucideIcon, LogOut, ChevronLeft, ChevronRight, AlertTriangle, Activity } from "lucide-react";
import { AvatarCircle } from "@/components/ui/custom-ui";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface SidebarLink {
  label: string;
  to: string;
  icon: LucideIcon;
}

interface DashboardSidebarProps {
  links: SidebarLink[];
  userName: string;
  userSubtitle?: string;
  userAvatar: string;
  onLogout?: () => void;
}

export function DashboardSidebar({ links, userName, userSubtitle, userAvatar, onLogout }: DashboardSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const dashboardHref = user ? `/dashboard/${user.role}` : "/";

  // Compute initials: use userAvatar only if it's short text (≤3 chars, not a URL)
  const initials =
    userAvatar && !userAvatar.startsWith("http") && !userAvatar.startsWith("/") && userAvatar.length <= 3
      ? userAvatar.toUpperCase()
      : userName
          .split(" ")
          .filter(Boolean)
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2) || "?";

  return (
    <>
    <aside className={cn("h-screen sticky top-0 bg-card border-r border-border flex flex-col justify-between", collapsed ? "w-16" : "w-60")}>
      <div>
        <div className={cn("flex items-center gap-2 p-4 border-b border-border", collapsed && "justify-center")}>
          <Link to={dashboardHref} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md gradient-primary flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary-foreground" />
            </div>
            {!collapsed && <span className="font-heading font-bold text-foreground">MediFlow</span>}
          </Link>
        </div>

        <nav className="p-2 space-y-1">
          {links.map((link) => {
            const [linkPath, linkQuery] = link.to.split("?");
            const linkParams = new URLSearchParams(linkQuery || "");
            const locationParams = new URLSearchParams(location.search);
            const isActive =
              location.pathname === linkPath &&
              (linkQuery
                ? [...linkParams.entries()].every(
                    ([k, v]) => locationParams.get(k) === v
                  )
                : !locationParams.get("tab"));
            return (
              <RouterNavLink
                key={link.to}
                to={link.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-body",
                  isActive
                    ? "bg-primary/10 text-primary border-l-2 border-primary font-medium"
                    : "text-muted-foreground hover:bg-muted",
                  collapsed && "justify-center px-2"
                )}
              >
                <link.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{link.label}</span>}
              </RouterNavLink>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <div className={cn("p-3 flex items-center gap-3", collapsed && "justify-center")}>
          <AvatarCircle initials={initials} size="sm" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{userName}</p>
              {userSubtitle && <p className="text-xs text-muted-foreground truncate">{userSubtitle}</p>}
            </div>
          )}
          {!collapsed && onLogout && (
            <button onClick={() => setShowLogoutConfirm(true)} className="text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

    </aside>

      {/* Logout confirmation overlay — rendered outside <aside> to escape its stacking context */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-xl p-6 w-80 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div className="text-center">
              <p className="font-heading font-semibold text-foreground mb-1">{t.sidebarLogout}?</p>
              <p className="text-sm text-muted-foreground">{t.sidebarLogoutConfirm}</p>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted"
              >
                {t.sidebarLogoutCancel}
              </button>
              <button
                onClick={() => { setShowLogoutConfirm(false); onLogout?.(); }}
                className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90"
              >
                {t.sidebarLogoutBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
