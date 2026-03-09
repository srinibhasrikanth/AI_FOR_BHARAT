import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, Eye, EyeOff, Mail, ShieldCheck, CheckCircle } from "lucide-react";
import { authApi } from "@/lib/api";

type Step = "email" | "otp" | "done";
type AppLanguage = "en" | "hi" | "te";

interface PwdChecks {
  length: boolean;
  upper: boolean;
  lower: boolean;
  special: boolean;
}

function getPwdChecks(pwd: string): PwdChecks {
  return {
    length:  pwd.length >= 8,
    upper:   /[A-Z]/.test(pwd),
    lower:   /[a-z]/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd),
  };
}

// ─── Translations ──────────────────────────────────────────────────────────────
interface ResetTranslations {
  activateAccount: string;
  resetPassword: string;
  activateDesc: string;
  resetDesc: string;
  accountCreated: string;
  emailLabel: string;
  sending: string;
  sendActivationCode: string;
  sendOtp: string;
  setYourPassword: string;
  enterOtp: string;
  codeSentTo: string;
  changeEmail: string;
  otpLabel: string;
  newPassword: string;
  confirmPassword: string;
  activating: string;
  setPasswordActivate: string;
  resetPasswordBtn: string;
  didntReceive: string;
  resend: string;
  accountActivated: string;
  activatedMsg: string;
  passwordReset: string;
  passwordResetMsg: string;
  goToLogin: string;
  backToLogin: string;
  alreadyActive: string;
  alreadyActiveMsg: string;
  pwdLength: string;
  pwdUpper: string;
  pwdLower: string;
  pwdSpecial: string;
  pwdMismatch: string;
  pwdRequirements: string;
  otpSent: string;
  failedSendOtp: string;
  failedReset: string;
}

const T: Record<AppLanguage, ResetTranslations> = {
  en: {
    activateAccount: "Activate Your Account",
    resetPassword: "Reset your password",
    activateDesc: "We'll send a 6-digit activation code to your email.",
    resetDesc: "Enter your registered email address and we'll send you a 6-digit OTP.",
    accountCreated: "Your account has been created. Request an OTP below to set your password.",
    emailLabel: "Email Address",
    sending: "Sending…",
    sendActivationCode: "Send Activation Code",
    sendOtp: "Send OTP",
    setYourPassword: "Set Your Password",
    enterOtp: "Enter OTP",
    codeSentTo: "A 6-digit code was sent to",
    changeEmail: "← Change email",
    otpLabel: "6-Digit OTP",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    activating: "Activating…",
    setPasswordActivate: "Set Password & Activate",
    resetPasswordBtn: "Reset Password",
    didntReceive: "Didn't receive the OTP?",
    resend: "Resend",
    accountActivated: "Account Activated!",
    activatedMsg: "Your password has been set and your account is now active. Welcome to MediFlow!",
    passwordReset: "Password Reset!",
    passwordResetMsg: "Your password has been updated successfully. You can now log in with your new password.",
    goToLogin: "Go to Login",
    backToLogin: "← Back to Login",
    alreadyActive: "Account Already Active",
    alreadyActiveMsg: "Your account is already activated. Please log in with your password.",
    pwdLength: "At least 8 characters",
    pwdUpper: "One uppercase letter",
    pwdLower: "One lowercase letter",
    pwdSpecial: "One special character (!@#$…)",
    pwdMismatch: "Passwords do not match.",
    pwdRequirements: "Password must be at least 8 characters and include uppercase, lowercase, and a special character.",
    otpSent: "OTP sent! Check your inbox (and spam folder).",
    failedSendOtp: "Failed to send OTP. Please try again.",
    failedReset: "Failed to reset password. Please check your OTP.",
  },
  hi: {
    activateAccount: "अपना खाता सक्रिय करें",
    resetPassword: "अपना पासवर्ड रीसेट करें",
    activateDesc: "हम आपके ईमेल पर 6 अंकों का सक्रियता कोड भेजेंगे।",
    resetDesc: "अपना पंजीकृत ईमेल पता दर्ज करें और हम आपको 6 अंकों का OTP भेजेंगे।",
    accountCreated: "आपका खाता बनाया जा चुका है। अपना पासवर्ड सेट करने के लिए नीचे OTP का अनुरोध करें।",
    emailLabel: "ईमेल पता",
    sending: "भेज रहे हैं…",
    sendActivationCode: "सक्रियता कोड भेजें",
    sendOtp: "OTP भेजें",
    setYourPassword: "अपना पासवर्ड सेट करें",
    enterOtp: "OTP दर्ज करें",
    codeSentTo: "6 अंकों का कोड भेजा गया",
    changeEmail: "← ईमेल बदलें",
    otpLabel: "6 अंकों का OTP",
    newPassword: "नया पासवर्ड",
    confirmPassword: "पासवर्ड की पुष्टि करें",
    activating: "सक्रिय किया जा रहा है…",
    setPasswordActivate: "पासवर्ड सेट करें और सक्रिय करें",
    resetPasswordBtn: "पासवर्ड रीसेट करें",
    didntReceive: "OTP नहीं मिला?",
    resend: "पुनः भेजें",
    accountActivated: "खाता सक्रिय हो गया!",
    activatedMsg: "आपका पासवर्ड सेट हो गया है और आपका खाता अब सक्रिय है। MediFlow में आपका स्वागत है!",
    passwordReset: "पासवर्ड रीसेट हो गया!",
    passwordResetMsg: "आपका पासवर्ड सफलतापूर्वक अपडेट हो गया है। अब आप अपने नए पासवर्ड से लॉगिन कर सकते हैं।",
    goToLogin: "लॉगिन पर जाएं",
    backToLogin: "← लॉगिन पर वापस जाएं",
    alreadyActive: "खाता पहले से सक्रिय है",
    alreadyActiveMsg: "आपका खाता पहले से सक्रिय है। कृपया अपने पासवर्ड से लॉगिन करें।",
    pwdLength: "कम से कम 8 अक्षर",
    pwdUpper: "एक बड़ा अक्षर (A-Z)",
    pwdLower: "एक छोटा अक्षर (a-z)",
    pwdSpecial: "एक विशेष अक्षर (!@#$…)",
    pwdMismatch: "पासवर्ड मेल नहीं खाते।",
    pwdRequirements: "पासवर्ड कम से कम 8 अक्षरों का होना चाहिए और इसमें बड़ा, छोटा और विशेष अक्षर होना चाहिए।",
    otpSent: "OTP भेजा गया! अपना इनबॉक्स (और स्पैम फ़ोल्डर) जांचें।",
    failedSendOtp: "OTP भेजने में विफल। कृपया पुनः प्रयास करें।",
    failedReset: "पासवर्ड रीसेट करने में विफल। कृपया अपना OTP जांचें।",
  },
  te: {
    activateAccount: "మీ ఖాతాను యాక్టివేట్ చేయండి",
    resetPassword: "మీ పాస్‌వర్డ్ రీసెట్ చేయండి",
    activateDesc: "మేము మీ ఇమెయిల్‌కు 6 అంకెల యాక్టివేషన్ కోడ్ పంపుతాము.",
    resetDesc: "మీ రిజిస్టర్డ్ ఇమెయిల్ అడ్రస్ ఎంటర్ చేయండి, మేము మీకు 6 అంకెల OTP పంపుతాము.",
    accountCreated: "మీ ఖాతా సృష్టించబడింది. మీ పాస్‌వర్డ్ సెట్ చేయడానికి దిగువ OTP అభ్యర్థించండి.",
    emailLabel: "ఇమెయిల్ చిరునామా",
    sending: "పంపుతున్నాం…",
    sendActivationCode: "యాక్టివేషన్ కోడ్ పంపండి",
    sendOtp: "OTP పంపండి",
    setYourPassword: "మీ పాస్‌వర్డ్ సెట్ చేయండి",
    enterOtp: "OTP నమోదు చేయండి",
    codeSentTo: "6 అంకెల కోడ్ పంపబడింది",
    changeEmail: "← ఇమెయిల్ మార్చండి",
    otpLabel: "6 అంకెల OTP",
    newPassword: "కొత్త పాస్‌వర్డ్",
    confirmPassword: "పాస్‌వర్డ్ నిర్ధారించండి",
    activating: "యాక్టివేట్ చేస్తున్నాం…",
    setPasswordActivate: "పాస్‌వర్డ్ సెట్ చేసి యాక్టివేట్ చేయండి",
    resetPasswordBtn: "పాస్‌వర్డ్ రీసెట్ చేయండి",
    didntReceive: "OTP అందలేదా?",
    resend: "మళ్ళీ పంపండి",
    accountActivated: "ఖాతా యాక్టివేట్ అయింది!",
    activatedMsg: "మీ పాస్‌వర్డ్ సెట్ చేయబడింది మరియు మీ ఖాతా ఇప్పుడు యాక్టివ్‌గా ఉంది. MediFlow కి స్వాగతం!",
    passwordReset: "పాస్‌వర్డ్ రీసెట్ అయింది!",
    passwordResetMsg: "మీ పాస్‌వర్డ్ విజయవంతంగా అప్‌డేట్ చేయబడింది. ఇప్పుడు మీ కొత్త పాస్‌వర్డ్‌తో లాగిన్ చేయవచ్చు.",
    goToLogin: "లాగిన్‌కు వెళ్ళండి",
    backToLogin: "← లాగిన్‌కు తిరిగి వెళ్ళండి",
    alreadyActive: "ఖాతా ఇప్పటికే యాక్టివ్‌గా ఉంది",
    alreadyActiveMsg: "మీ ఖాతా ఇప్పటికే యాక్టివేట్ అయింది. దయచేసి మీ పాస్‌వర్డ్‌తో లాగిన్ చేయండి.",
    pwdLength: "కనీసం 8 అక్షరాలు",
    pwdUpper: "ఒక పెద్ద అక్షరం (A-Z)",
    pwdLower: "ఒక చిన్న అక్షరం (a-z)",
    pwdSpecial: "ఒక ప్రత్యేక అక్షరం (!@#$…)",
    pwdMismatch: "పాస్‌వర్డ్‌లు సరిపోలలేదు.",
    pwdRequirements: "పాస్‌వర్డ్ కనీసం 8 అక్షరాలు ఉండాలి మరియు పెద్ద, చిన్న మరియు ప్రత్యేక అక్షరం ఉండాలి.",
    otpSent: "OTP పంపబడింది! మీ ఇన్‌బాక్స్ (మరియు స్పామ్ ఫోల్డర్) తనిఖీ చేయండి.",
    failedSendOtp: "OTP పంపడం విఫలమైంది. దయచేసి మళ్ళీ ప్రయత్నించండి.",
    failedReset: "పాస్‌వర్డ్ రీసెట్ చేయడం విఫలమైంది. దయచేసి మీ OTP తనిఖీ చేయండి.",
  },
};

const VALID_LANGS: AppLanguage[] = ["en", "hi", "te"];

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>("email");

  // Language: initialised from URL param, then updated from backend response
  const langParam = searchParams.get("lang") as AppLanguage | null;
  const [lang, setLang] = useState<AppLanguage>(
    langParam && VALID_LANGS.includes(langParam) ? langParam : "en"
  );
  const t = T[lang];

  const isActivation = !!searchParams.get("email");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [alreadyActivated, setAlreadyActivated] = useState(false);

  // If email was pre-filled from URL, show OTP step directly only when user clicks Send OTP
  useEffect(() => {
    if (searchParams.get("email")) {
      setInfo(t.accountCreated);
    }
  }, []); // eslint-disable-line

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await authApi.requestPasswordReset(email.trim().toLowerCase());
      // Switch the page language to match the user's stored preference
      const userLang = (res as any).lang as AppLanguage | undefined;
      if (userLang && VALID_LANGS.includes(userLang)) {
        setLang(userLang);
      }
      if (isActivation && (res as any).alreadyVerified) {
        setAlreadyActivated(true);
      } else {
        setInfo(T[userLang && VALID_LANGS.includes(userLang) ? userLang : lang].otpSent);
        setStep("otp");
      }
    } catch (err: any) {
      setError(err.message || t.failedSendOtp);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const checks = getPwdChecks(newPassword);
    if (!checks.length || !checks.upper || !checks.lower || !checks.special) {
      setError(t.pwdRequirements);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.pwdMismatch);
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(email.trim().toLowerCase(), otp.trim(), newPassword);
      setStep("done");
    } catch (err: any) {
      setError(err.message || t.failedReset);
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2.5 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="min-h-screen flex">
      {/* Left gradient panel */}
      <div className="hidden lg:flex lg:w-2/5 gradient-primary items-center justify-center p-12">
        <div className="text-center">
          <ShieldCheck className="w-16 h-16 text-primary-foreground mx-auto mb-6" />
          <h2 className="text-3xl font-heading font-bold text-primary-foreground mb-4">
            {isActivation ? t.activateAccount : t.resetPassword}
          </h2>
          <p className="text-primary-foreground/80 text-lg">
            {isActivation
              ? t.activateDesc
              : t.resetDesc}
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-[420px]">
          {/* Mobile header */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Activity className="w-7 h-7 text-primary" />
            <span className="font-heading font-bold text-xl gradient-text">MediFlow</span>
          </div>

          {/* ── Already activated screen ── */}
          {alreadyActivated && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-heading font-bold text-foreground mb-2">{t.alreadyActive}</h2>
              <p className="text-sm text-muted-foreground mb-8">
                {t.alreadyActiveMsg}
              </p>
              <Link
                to="/login"
                className="inline-block py-2.5 px-8 text-sm font-medium text-primary-foreground gradient-primary rounded-md"
              >
                {t.goToLogin}
              </Link>
            </div>
          )}

          {/* ── Step 1: Enter Email ── */}
          {!alreadyActivated && step === "email" && (
            <>
              <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
                {isActivation ? t.activateAccount : t.resetPassword}
              </h2>
              <p className="text-sm text-muted-foreground mb-8">
                {isActivation
                  ? t.activateDesc
                  : t.resetDesc}
              </p>

              {info && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-sm text-blue-700">
                  {info}
                </div>
              )}

              <form onSubmit={handleRequestOtp} className="space-y-4">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t.emailLabel}</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputCls + " pl-9"}
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 text-sm font-medium text-primary-foreground gradient-primary rounded-md disabled:opacity-50"
                >
                  {loading ? t.sending : isActivation ? t.sendActivationCode : t.sendOtp}
                </button>
              </form>
            </>
          )}

          {/* ── Step 2: Enter OTP + New Password ── */}
          {!alreadyActivated && step === "otp" && (
            <>
              <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
                {isActivation ? t.setYourPassword : t.enterOtp}
              </h2>
              <p className="text-sm text-muted-foreground mb-2">
                {t.codeSentTo} <span className="font-medium text-foreground">{email}</span>.
              </p>
              <button
                type="button"
                onClick={() => { setStep("email"); setError(""); setOtp(""); }}
                className="text-xs text-primary underline mb-6 block"
              >
                {t.changeEmail}
              </button>

              {info && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-sm text-blue-700">
                  {info}
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t.otpLabel}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className={inputCls + " tracking-[0.5em] text-center text-lg font-bold"}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t.newPassword}</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputCls + " pr-10"}
                      required
                    />
                    <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Password strength checklist */}
                  {newPassword.length > 0 && (() => {
                    const c = getPwdChecks(newPassword);
                    return (
                      <ul className="mt-2 space-y-1">
                        {([
                          [c.length,  t.pwdLength],
                          [c.upper,   t.pwdUpper],
                          [c.lower,   t.pwdLower],
                          [c.special, t.pwdSpecial],
                        ] as [boolean, string][]).map(([ok, label]) => (
                          <li key={label} className={`flex items-center gap-1.5 text-xs ${ok ? "text-green-600" : "text-muted-foreground"}`}>
                            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                              ok ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
                            }`}>{ok ? "✓" : "○"}</span>
                            {label}
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t.confirmPassword}</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputCls + " pr-10"}
                      required
                    />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 text-sm font-medium text-primary-foreground gradient-primary rounded-md disabled:opacity-50"
                >
                  {loading ? t.activating : isActivation ? t.setPasswordActivate : t.resetPasswordBtn}
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  {t.didntReceive}{" "}
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    className="text-primary underline"
                    disabled={loading}
                  >
                    {t.resend}
                  </button>
                </p>
              </form>
            </>
          )}

          {/* ── Step 3: Success ── */}
          {!alreadyActivated && step === "done" && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              {isActivation ? (
                <>
                  <h2 className="text-2xl font-heading font-bold text-foreground mb-2">{t.accountActivated}</h2>
                  <p className="text-sm text-muted-foreground mb-8">
                    {t.activatedMsg}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-heading font-bold text-foreground mb-2">{t.passwordReset}</h2>
                  <p className="text-sm text-muted-foreground mb-8">
                    {t.passwordResetMsg}
                  </p>
                </>
              )}
              <Link
                to="/login"
                className="inline-block py-2.5 px-8 text-sm font-medium text-primary-foreground gradient-primary rounded-md"
              >
                {t.goToLogin}
              </Link>
            </div>
          )}

          {step !== "done" && !alreadyActivated && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              <Link to="/login" className="text-primary font-medium">{t.backToLogin}</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
