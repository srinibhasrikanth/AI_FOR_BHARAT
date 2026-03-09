import { DashboardSidebar } from "./DashboardSidebar";
import { TopBar } from "./TopBar";
import { type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  links: { label: string; to: string; icon: LucideIcon }[];
  userName: string;
  userSubtitle?: string;
  userAvatar: string;
}

export function DashboardLayout({ children, title, links, userName, userSubtitle, userAvatar }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen w-full bg-secondary">
      <DashboardSidebar
        links={links}
        userName={userName}
        userSubtitle={userSubtitle}
        userAvatar={userAvatar}
        onLogout={handleLogout}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={title} userName={userName} userAvatar={userAvatar} />
        <main className="flex-1 px-6 pb-6 pt-4">
          {children}
        </main>
      </div>
    </div>
  );
}
