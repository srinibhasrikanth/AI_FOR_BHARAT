import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Mic, Shield, FileText, Pill, AlertTriangle, Clock,
  Users, QrCode, Lock, Zap, Globe, Stethoscope,
  Heart, ClipboardList, UserCheck, ArrowRight,
  Phone, Droplets, Activity
} from "lucide-react";

const Landing = () => {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid md:grid-cols-5 gap-12 items-center">
          <div className="md:col-span-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium border border-accent/20 mb-6">
              <Zap className="w-3 h-3" /> {t.landingBadge}
            </span>
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground leading-tight mb-6">
              {t.landingHero} <span className="gradient-text">{t.landingHeroHighlight}</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl">
              {t.landingSubtitle}
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              <Link to="/signup/patient" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-primary-foreground gradient-primary rounded-md">
                {t.landingStartFree} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> {t.landingHipaa}</span>
              <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> {t.landingBuiltForIndia}</span>
              <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> {t.landingRealTimeAI}</span>
            </div>
          </div>

          {/* SOAP Note Mockup */}
          <div className="md:col-span-2">
            <div className="bg-card border border-border rounded-lg shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-xs font-mono text-muted-foreground">{t.landingSoapAuto}</span>
              </div>
              {[
                { label: "S", title: "Subjective", text: "Patient reports chest discomfort for 2 days, worse on exertion..." },
                { label: "O", title: "Objective", text: "BP 150/95, HR 88, SpO2 97%, mild pedal edema noted..." },
                { label: "A", title: "Assessment", text: "Uncontrolled essential hypertension (I10)..." },
                { label: "P", title: "Plan", text: "Start Amlodipine 5mg OD, lifestyle modification, follow-up in 2 weeks..." },
              ].map((s) => (
                <div key={s.label} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 rounded gradient-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{s.label}</span>
                    <span className="text-xs font-heading font-bold text-foreground">{s.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-8 leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Categories */}
      <section id="features" className="bg-secondary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-heading font-bold text-foreground text-center mb-12">{t.landingFeaturesTitle}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Mic, title: t.landingFeature1Title, items: t.landingFeature1Items },
              { icon: Pill, title: t.landingFeature2Title, items: t.landingFeature2Items },
              { icon: FileText, title: t.landingFeature3Title, items: t.landingFeature3Items },
            ].map((cat) => (
              <div key={cat.title} className="bg-card border border-border rounded-lg p-6 shadow-card border-l-4 border-l-accent">
                <cat.icon className="w-8 h-8 text-accent mb-4" />
                <h3 className="text-lg font-heading font-bold text-foreground mb-3">{cat.title}</h3>
                <ul className="space-y-2">
                  {cat.items.map((item) => (
                    <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-heading font-bold text-foreground text-center mb-12">{t.landingHowTitle}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative">
            {[
              { step: 1, icon: Mic, text: t.landingStep1 },
              { step: 2, icon: ClipboardList, text: t.landingStep2 },
              { step: 3, icon: Users, text: t.landingStep3 },
              { step: 4, icon: FileText, text: t.landingStep4 },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-14 h-14 rounded-full gradient-primary text-primary-foreground font-heading font-bold text-xl flex items-center justify-center mx-auto mb-4">
                  {s.step}
                </div>
                <s.icon className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Doctors / For Patients */}
      <section id="for-doctors" className="bg-secondary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: Stethoscope, label: t.landingForDoctors, cta: t.landingDoctorCta,
                benefits: t.landingDoctorBenefits,
              },
              {
                icon: Heart, label: t.landingForPatients, cta: t.landingPatientCta,
                benefits: t.landingPatientBenefits,
              },
            ].map((panel) => (
              <div key={panel.label} className="bg-card border border-border rounded-lg p-8 shadow-card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                    <panel.icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-heading font-bold text-foreground">{panel.label}</h3>
                </div>
                <ul className="space-y-3 mb-6">
                  {panel.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <UserCheck className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
                <Link to="/signup/patient" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-primary-foreground gradient-primary rounded-md">
                  {panel.cta} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Emergency QR Spotlight */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-secondary border border-border rounded-lg p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-4">
                  {t.landingQrTitle}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {t.landingQrDesc}
                </p>
                <Link to="/signup/patient" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-primary-foreground gradient-primary rounded-md">
                  {t.landingQrCta} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="flex justify-center">
                <div className="bg-card border border-border rounded-lg p-6 shadow-card w-72">
                  <div className="flex items-center gap-2 mb-4">
                    <QrCode className="w-5 h-5 text-primary" />
                    <span className="text-sm font-heading font-bold text-foreground">{t.landingEmergencyCard}</span>
                  </div>
                  <div className="w-32 h-32 mx-auto mb-4 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                    <QrCode className="w-16 h-16 text-muted-foreground/30" />
                  </div>
                  <div className="space-y-2 text-xs">
                    {[
                      { icon: Droplets, label: t.bloodGroup, value: "B+" },
                      { icon: AlertTriangle, label: "Allergies", value: "Penicillin" },
                      { icon: Pill, label: "Medications", value: "Amlodipine, Metformin" },
                      { icon: Phone, label: "Emergency", value: "+91 99887 76656" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-2">
                        <row.icon className="w-3 h-3 text-accent" />
                        <span className="text-muted-foreground">{row.label}:</span>
                        <span className="text-foreground font-medium">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Landing;
