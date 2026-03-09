import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ShieldOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

const Unauthorized = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    console.error(
      "401 Unauthorized: User with role",
      user?.role,
      "attempted to access",
      location.pathname
    );
  }, [location.pathname, user?.role]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <ShieldOff className="w-16 h-16 text-destructive" />
        </div>
        <h1 className="mb-2 text-4xl font-bold">401</h1>
        <p className="mb-1 text-xl text-muted-foreground">{t.unauthorizedTitle}</p>
        <p className="mb-6 text-sm text-muted-foreground">
          {t.unauthorizedMsg}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {user ? (
            <button
              onClick={() => navigate(`/dashboard/${user.role}`, { replace: true })}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              {t.unauthorizedHome}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;