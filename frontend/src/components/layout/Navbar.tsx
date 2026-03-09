import { Activity, Menu, X, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, AppLanguage } from "@/contexts/LanguageContext";

const LANG_OPTIONS: { code: AppLanguage; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi",   native: "हिन्दी" },
  { code: "te", label: "Telugu",  native: "తెలుగు" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const logoHref = isAuthenticated && user ? `/dashboard/${user.role}` : "/";

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentLang = LANG_OPTIONS.find((l) => l.code === language) || LANG_OPTIONS[0];

  return (
    <nav className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to={logoHref} className="flex items-center gap-2">
            <Activity className="w-7 h-7 text-primary" />
            <span className="font-heading font-bold text-xl gradient-text">MediFlow</span>
          </Link>

          <div className="hidden md:flex items-center gap-3">
            {/* Language switcher */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:text-foreground hover:bg-muted transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span>{currentLang.native}</span>
              </button>
              {langOpen && (
                <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden z-50 min-w-[130px]">
                  {LANG_OPTIONS.map((opt) => (
                    <button
                      key={opt.code}
                      onClick={() => { setLanguage(opt.code); setLangOpen(false); }}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors hover:bg-muted ${language === opt.code ? "text-primary font-medium bg-primary/5" : "text-foreground"}`}
                    >
                      <span>{opt.native}</span>
                      {language === opt.code && <span className="ml-auto text-primary text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Link to="/login" className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/5">
              {t.navLogin}
            </Link>
            <Link to="/signup/patient" className="px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-md">
              {t.navGetStarted}
            </Link>
          </div>

          <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card px-4 pb-4 space-y-2">
          {/* Mobile language switcher */}
          <div className="flex gap-2 pt-3 pb-1">
            {LANG_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                onClick={() => setLanguage(opt.code)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition-colors ${language === opt.code ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {opt.native}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Link to="/login" className="flex-1 text-center px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md">{t.navLogin}</Link>
            <Link to="/signup/patient" className="flex-1 text-center px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-md">{t.navGetStarted}</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
