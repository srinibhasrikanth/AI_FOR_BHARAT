import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

const SAVED_EMAILS_KEY = "mediflow_recent_emails";

function getSavedEmails(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_EMAILS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveEmail(val: string) {
  if (!val.includes("@")) return; // only save email-like identifiers
  const prev = getSavedEmails().filter((e) => e !== val);
  localStorage.setItem(SAVED_EMAILS_KEY, JSON.stringify([val, ...prev].slice(0, 5)));
}

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [savedEmails, setSavedEmails] = useState<string[]>([]);
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => { setSavedEmails(getSavedEmails()); }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(`/dashboard/${user.role}`);
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setUnverifiedEmail("");

    try {
      await login(identifier, password);
      saveEmail(identifier.trim().toLowerCase());
      setSavedEmails(getSavedEmails());
      // Navigation will happen via useEffect after login updates auth state
    } catch (err: any) {
      if (err.statusCode === 403 && err.data?.code === "UNVERIFIED") {
        setUnverifiedEmail(identifier.trim().toLowerCase());
      } else {
        setError(err.message || "Login failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left gradient panel — desktop only */}
      <div className="hidden lg:flex lg:w-2/5 gradient-primary items-center justify-center p-12">
        <div className="text-center">
          <Activity className="w-16 h-16 text-primary-foreground mx-auto mb-6" />
          <h2 className="text-3xl font-heading font-bold text-primary-foreground mb-4">MediFlow</h2>
          <p className="text-primary-foreground/80 text-lg">{t.loginTagline}</p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-[420px]">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Activity className="w-7 h-7 text-primary" />
            <span className="font-heading font-bold text-xl gradient-text">MediFlow</span>
          </div>

          <h2 className="text-2xl font-heading font-bold text-foreground mb-2">{t.loginWelcome}</h2>
          <p className="text-sm text-muted-foreground mb-8">{t.loginSubtitle}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {unverifiedEmail && (
              <div className="bg-amber-50 border border-amber-300 rounded-md px-3 py-3 text-sm text-amber-800">
                <p className="font-medium mb-1">{t.loginUnverifiedTitle}</p>
                <p className="mb-2">{t.loginUnverifiedMsg}</p>
                <Link
                  to={`/reset-password?email=${encodeURIComponent(unverifiedEmail)}`}
                  className="underline font-medium text-amber-900"
                >
                  {t.loginActivate}
                </Link>
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t.loginEmailPhone}</label>
              <input
                type="text"
                list="email-suggestions"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-3 py-2.5 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
                autoComplete="username"
              />
              {savedEmails.length > 0 && (
                <datalist id="email-suggestions">
                  {savedEmails.map((e) => <option key={e} value={e} />)}
                </datalist>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t.loginPassword}</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2.5 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring pr-10" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="text-right mt-1"><Link to="/reset-password" className="text-xs text-primary">{t.loginForgot}</Link></div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 text-sm font-medium text-primary-foreground gradient-primary rounded-md disabled:opacity-50">
              {loading ? t.loginLoading : t.loginBtn}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t.loginNoAccount} <Link to="/signup/patient" className="text-primary font-medium">{t.loginSignUp}</Link>
          </p>
          <p className="text-center text-xs text-muted-foreground mt-4">
            {t.loginDoctorPharmacist}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
