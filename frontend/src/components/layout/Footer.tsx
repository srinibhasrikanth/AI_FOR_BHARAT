import { Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="bg-card border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-6 h-6 text-primary" />
              <span className="font-heading font-bold text-lg gradient-text">MediFlow</span>
            </div>
            <p className="text-sm text-muted-foreground">{t.footerTagline}</p>
          </div>
          <div>
            <h4 className="font-heading font-bold text-sm text-foreground mb-3">{t.footerProduct}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features">{t.footerFeatures}</a></li>
              <li><a href="#how-it-works">{t.footerHowItWorks}</a></li>
              <li><a href="#">{t.footerPricing}</a></li>
              <li><a href="#">{t.footerApi}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-bold text-sm text-foreground mb-3">{t.footerCompany}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#">{t.footerAbout}</a></li>
              <li><a href="#">{t.footerCareers}</a></li>
              <li><a href="#">{t.footerBlog}</a></li>
              <li><a href="#">{t.footerPress}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-bold text-sm text-foreground mb-3">{t.footerContact}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>hello@mediflow.in</li>
              <li>+91 80 1234 5678</li>
              <li>Bengaluru, India</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border mt-8 pt-6 text-center text-xs text-muted-foreground">
          {t.footerCopyright}
        </div>
      </div>
    </footer>
  );
}
