import { Globe } from "lucide-react";
import { useLanguage, AppLanguage } from "@/contexts/LanguageContext";
import { useRef, useState, useEffect } from "react";

interface TopBarProps {
  title: string;
  userName?: string;
  userAvatar?: string;
}

export function TopBar({ title, userName, userAvatar }: TopBarProps) {
  const { language, setLanguage } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  const LANG_OPTIONS: { code: AppLanguage; native: string }[] = [
    { code: "en", native: "English" },
    { code: "hi", native: "हिन्दी" },
    { code: "te", native: "తెలుగు" },
  ];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between sticky top-0 z-10">
      {title ? <h1 className="text-xl font-heading font-bold text-foreground">{title}</h1> : <span />}
      <div className="flex items-center gap-3">
        {/* Language switcher */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-md hover:text-foreground hover:bg-muted transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            {LANG_OPTIONS.find((l) => l.code === language)?.native ?? "EN"}
          </button>
          {langOpen && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden z-50 min-w-[120px]">
              {LANG_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  onClick={() => { setLanguage(opt.code); setLangOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted transition-colors ${language === opt.code ? "text-primary font-medium" : "text-foreground"}`}
                >
                  {opt.native}
                  {language === opt.code && <span className="ml-auto text-primary text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
