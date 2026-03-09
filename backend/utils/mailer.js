const nodemailer = require('nodemailer');

/**
 * Creates a nodemailer transporter from environment variables.
 * Supports generic SMTP (SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS)
 * or Gmail shorthand (GMAIL_USER / GMAIL_PASS).
 *
 * Required .env keys (one of the two sets):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *   — OR —
 *   GMAIL_USER, GMAIL_PASS
 */
const createTransporter = () => {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Gmail shorthand
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
};

const FROM_ADDRESS = process.env.MAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER || 'no-reply@mediflow.app';

// ---------------------------------------------------------------------------
// Shared design tokens (derived from the app's CSS custom properties)
// ---------------------------------------------------------------------------
const COLORS = {
  primary:      '#1F70A3', // hsl(203 68% 38%)
  accent:       '#0D9B8D', // hsl(174 84% 33%)
  textDark:     '#1A212D', // hsl(220 26% 14%)
  textMuted:    '#65758B', // hsl(215 16% 47%)
  textSubtle:   '#8F9BB3', // lighter muted
  bgPage:       '#F2F4F7', // hsl(216 25% 96%)
  bgCard:       '#FFFFFF',
  bgOtp:        '#EDF3F8', // tinted primary surface
  border:       '#E1E7EF', // hsl(214 32% 91%)
  success:      '#18924A', // hsl(142 72% 37%)
  destructive:  '#E03131', // hsl(0 84% 60%)
};

// ---------------------------------------------------------------------------
// Shared i18n lookup maps — only "MediFlow" brand stays in English
// ---------------------------------------------------------------------------
const HEADER_TAGLINE = {
  en: 'Healthcare Platform',
  hi: 'स्वास्थ्य सेवा मंच',
  te: 'ఆరోగ్య సేవా వేదిక',
};

const FOOTER_TEXT = {
  en: { rights: 'All rights reserved', auto: 'This email was sent automatically — please do not reply.' },
  hi: { rights: 'सर्वाधिकार सुरक्षित', auto: 'यह ईमेल स्वचालित रूप से भेजा गया है — कृपया उत्तर न दें।' },
  te: { rights: 'అన్ని హక్కులు రిజర్వ్ చేయబడ్డాయి', auto: 'ఈ ఇమెయిల్ స్వయంచాలకంగా పంపబడింది — దయచేసి ప్రతిస్పందించవద్దు.' },
};

const VERIFIED_LABEL = {
  en: 'Verified',
  hi: 'सत्यापित',
  te: 'ధృవీకరించబడింది',
};

const NEED_HELP_TEXT = {
  en: 'Need help? Contact your MediFlow administrator.',
  hi: 'सहायता चाहिए? अपने MediFlow प्रशासक से संपर्क करें।',
  te: 'సహాయం కావాలా? మీ MediFlow నిర్వాహకుడిని సంప్రదించండి.',
};

/**
 * Returns the shared outer wrapper + branded header used in every email.
 * @param {string} previewText  — short preview sentence shown in inbox
 * @param {string} lang         — 'en' | 'hi' | 'te'
 */
const emailOpen = (previewText = '', lang = 'en') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>MediFlow</title>
  <!--[if !mso]><!-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bgPage};font-family:'Inter',Arial,sans-serif;">
  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;">${previewText}&nbsp;&zwnj;&hairsp;&nbsp;&zwnj;&hairsp;&nbsp;</div>

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.bgPage};padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Card -->
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background-color:${COLORS.bgCard};border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header gradient bar -->
          <tr>
            <td style="background:linear-gradient(135deg,${COLORS.primary},${COLORS.accent});padding:28px 36px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;">Medi<span style="opacity:0.85;">Flow</span></span>
                  </td>
                  <td align="right">
                    <span style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.75);letter-spacing:0.5px;text-transform:uppercase;">${HEADER_TAGLINE[lang] || HEADER_TAGLINE.en}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
`;

/**
 * Returns the shared footer + closing tags.
 * @param {string} lang — 'en' | 'hi' | 'te'
 */
const emailClose = (lang = 'en') => `
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${COLORS.bgPage};border-top:1px solid ${COLORS.border};padding:20px 36px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${COLORS.textSubtle};line-height:1.6;">
                © ${new Date().getFullYear()} MediFlow &middot; ${(FOOTER_TEXT[lang] || FOOTER_TEXT.en).rights}<br/>
                ${(FOOTER_TEXT[lang] || FOOTER_TEXT.en).auto}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// Persona display names (multilingual)
// ---------------------------------------------------------------------------
const PERSONA_BADGE = {
  en: { patient: 'Patient Account', doctor: 'Doctor Account', pharmacist: 'Pharmacist Account', admin: 'Administrator Account' },
  hi: { patient: 'मरीज़ खाता', doctor: 'डॉक्टर खाता', pharmacist: 'फार्मासिस्ट खाता', admin: 'प्रशासक खाता' },
  te: { patient: 'రోగి ఖాతా', doctor: 'డాక్టర్ ఖాతా', pharmacist: 'ఫార్మసిస్ట్ ఖాతా', admin: 'నిర్వాహకుడి ఖాతా' },
};

// ---------------------------------------------------------------------------
// Multilingual content — OTP email (password reset for verified users)
// ---------------------------------------------------------------------------
const OTP_CONTENT = {
  en: {
    subject:    'Your MediFlow Password Reset OTP',
    preview:    'Use the code below to reset your MediFlow password.',
    title:      'Password Reset Request',
    body:       `We received a request to reset your MediFlow password. Enter the one-time code below — it expires in <strong style="color:${COLORS.textDark};">10 minutes</strong>.`,
    otpLabel:   'Your OTP Code',
    disclaimer: 'If you did not request a password reset, you can safely ignore this email. Your account remains secure.',
  },
  hi: {
    subject:    'MediFlow पासवर्ड रीसेट OTP',
    preview:    'अपना MediFlow पासवर्ड रीसेट करने के लिए नीचे दिए गए कोड का उपयोग करें।',
    title:      'पासवर्ड रीसेट अनुरोध',
    body:       `हमें आपका MediFlow पासवर्ड रीसेट करने का अनुरोध प्राप्त हुआ। नीचे दिया गया एकमुश्त कोड दर्ज करें — यह <strong style="color:${COLORS.textDark};">10 मिनट</strong> में समाप्त हो जाएगा।`,
    otpLabel:   'आपका OTP कोड',
    disclaimer: 'यदि आपने पासवर्ड रीसेट का अनुरोध नहीं किया है तो इस ईमेल को अनदेखा करें। आपका खाता सुरक्षित है।',
  },
  te: {
    subject:    'MediFlow పాస్‌వర్డ్ రీసెట్ OTP',
    preview:    'మీ MediFlow పాస్‌వర్డ్‌ను రీసెట్ చేయడానికి దిగువ కోడ్‌ను ఉపయోగించండి.',
    title:      'పాస్‌వర్డ్ రీసెట్ అభ్యర్థన',
    body:       `మీ MediFlow పాస్‌వర్డ్‌ను రీసెట్ చేయమని మాకు అభ్యర్థన వచ్చింది. దిగువ కోడ్ నమోదు చేయండి — ఇది <strong style="color:${COLORS.textDark};">10 నిమిషాలలో</strong> గడువు తీరిపోతుంది.`,
    otpLabel:   'మీ OTP కోడ్',
    disclaimer: 'మీరు పాస్‌వర్డ్ రీసెట్ అభ్యర్థించకపోతే ఈ ఇమెయిల్‌ను విస్మరించండి. మీ ఖాతా సురక్షితంగా ఉంది.',
  },
};

// ---------------------------------------------------------------------------
// Multilingual content — Signup notification email (no OTP, just activation link)
// Sent immediately after account creation for ALL personas
// ---------------------------------------------------------------------------
const SIGNUP_CONTENT = {
  en: {
    subject:    (name) => `Your MediFlow account is ready, ${name}`,
    preview:    (name) => `Hi ${name}, your account has been created. Click below to activate it.`,
    title:      () => 'Your Account Is Ready',
    body1:      (name) => `Hi ${name}, welcome to MediFlow. Your account has been successfully created. Click the button below to activate your account and set your password.`,
    body2:      'The activation link will take you to a secure page where you can set your credentials.',
    linkText:   'Activate My Account',
    disclaimer: "If you didn't create a MediFlow account, you can safely ignore this email.",
  },
  hi: {
    subject:    (name) => `आपका MediFlow खाता तैयार है, ${name}`,
    preview:    (name) => `नमस्ते ${name}, आपका खाता बनाया गया है। सक्रिय करने के लिए नीचे क्लिक करें।`,
    title:      () => 'आपका खाता तैयार है',
    body1:      (name) => `नमस्ते ${name}, MediFlow में आपका स्वागत है। आपका खाता सफलतापूर्वक बनाया गया है। खाता सक्रिय करने और पासवर्ड सेट करने के लिए नीचे बटन पर क्लिक करें।`,
    body2:      'सक्रियता लिंक आपको एक सुरक्षित पृष्ठ पर ले जाएगा जहाँ आप अपना पासवर्ड सेट कर सकते हैं।',
    linkText:   'खाता सक्रिय करें',
    disclaimer: 'यदि आपने MediFlow खाता नहीं बनाया है तो इस ईमेल को अनदेखा करें।',
  },
  te: {
    subject:    (name) => `మీ MediFlow ఖాతా సిద్ధంగా ఉంది, ${name}`,
    preview:    (name) => `నమస్కారం ${name}, మీ ఖాతా సృష్టించబడింది. యాక్టివేట్ చేయడానికి దిగువ క్లిక్ చేయండి.`,
    title:      () => 'మీ ఖాతా సిద్ధంగా ఉంది',
    body1:      (name) => `నమస్కారం ${name}, MediFlow కి స్వాగతం. మీ ఖాతా విజయవంతంగా సృష్టించబడింది. ఖాతాను యాక్టివేట్ చేసి పాస్‌వర్డ్ సెట్ చేయడానికి దిగువ బటన్ క్లిక్ చేయండి.`,
    body2:      'యాక్టివేషన్ లింక్ మిమ్మల్ని మీ పాస్‌వర్డ్ సెట్ చేయడానికి ఒక సురక్షిత పేజీకి తీసుకెళ్తుంది.',
    linkText:   'ఖాతాను యాక్టివేట్ చేయండి',
    disclaimer: 'మీరు MediFlow ఖాతా సృష్టించకపోతే ఈ ఇమెయిల్‌ను విస్మరించండి.',
  },
};

// ---------------------------------------------------------------------------
// Multilingual content — Activation email (verify e-mail + set password)
// Used for ALL personas; patients get their chosen language, others get 'en'
// ---------------------------------------------------------------------------
const ACTIVATION_CONTENT = {
  en: {
    subject:    () => 'Activate your MediFlow account',
    preview:    (name) => `Welcome ${name}! Enter the code below to activate your account.`,
    title:      () => 'Activate Your Account',
    body1:      (name) => `Hi ${name}, your MediFlow account has been created. Enter the one-time code below to verify your email address and set your password.`,
    body2:      'This code expires in <strong>10 minutes</strong>. After entering it on the page, you\'ll be prompted to choose a new password.',
    otpLabel:   'Activation Code',
    linkIntro:  'Or go directly to the activation page:',
    linkText:   'Set My Password',
    disclaimer: 'If you didn\'t create a MediFlow account, you can safely ignore this email.',
  },
  hi: {
    subject:    () => 'MediFlow खाता सक्रिय करें',
    preview:    (name) => `नमस्ते ${name}! खाता सक्रिय करने के लिए नीचे कोड दर्ज करें।`,
    title:      () => 'अपना खाता सक्रिय करें',
    body1:      (name) => `नमस्ते ${name}, आपका MediFlow खाता बनाया गया है। अपना ईमेल सत्यापित करने और पासवर्ड  सेट करने के लिए नीचे दिया एकमुश्त कोड दर्ज करें।`,
    body2:      'यह कोड <strong>10 मिनट</strong> में समाप्त हो जाएगा। कोड दर्ज करने के बाद आपसे नया पासवर्ड  सेट करने के लिए कहा जाएगा।',
    otpLabel:   'सक्रियता कोड',
    linkIntro:  'या सीधे सक्रियता पृष्ठ पर जाएं:',
    linkText:   'पासवर्ड सेट करें',
    disclaimer: 'यदि आपने MediFlow खाता नहीं बनाया है तो इस ईमेल को अनदेखा करें।',
  },
  te: {
    subject:    () => 'మీ MediFlow ఖాతాను యాక్టివేట్ చేయండి',
    preview:    (name) => `నమస్కారం ${name}! ఖాతాను యాక్టివేట్ చేయడానికి దిగువ కోడ్ నమోదు చేయండి.`,
    title:      () => 'మీ ఖాతాను యాక్టివేట్ చేయండి',
    body1:      (name) => `నమస్కారం ${name}, మీ MediFlow ఖాతా సృష్టించబడింది. మీ ఇమెయిల్‌ను ధృవీకరించి పాస్‌వర్డ్ సెట్ చేయడానికి దిగువ కోడ్ నమోదు చేయండి.`,
    body2:      'ఈ కోడ్ <strong>10 నిమిషాలలో</strong> గడువు తీరిపోతుంది. కోడ్ నమోదు చేసిన తర్వాత కొత్త పాస్‌వర్డ్ సెట్ చేయమని అడుగుతారు.',
    otpLabel:   'యాక్టివేషన్ కోడ్',
    linkIntro:  'లేదా నేరుగా యాక్టివేషన్ పేజీకి వెళ్ళండి:',
    linkText:   'పాస్‌వర్డ్ సెట్ చేయండి',
    disclaimer: 'మీరు MediFlow ఖాతా సృష్టించకపోతే ఈ ఇమెయిల్‌ను విస్మరించండి.',
  },
};

// ---------------------------------------------------------------------------
// Multilingual content — Welcome email (sent AFTER password is set)
// ---------------------------------------------------------------------------
const WELCOME_CONTENT = {
  // English — all personas
  patient_en: {
    subject:  (name) => `Welcome to MediFlow, ${name}!`,
    title:    (name) => `Welcome to MediFlow, ${name}!`,
    body:     'Your patient account is now verified and active. Access your health records, prescriptions, lab reports, and consultation history directly from your dashboard.',
    ctaText:  'Go to My Dashboard',
    ctaPath:  '/dashboard/patient',
  },
  doctor_en: {
    subject:  (name) => `Welcome to MediFlow, Dr. ${name}!`,
    title:    (name) => `Welcome, Dr. ${name}!`,
    body:     'Your doctor account is now verified and active. You can start managing patient consultations, creating SOAP notes, prescribing medicines, and reviewing records from your dashboard.',
    ctaText:  'Go to Dashboard',
    ctaPath:  '/dashboard/doctor',
  },
  pharmacist_en: {
    subject:  (name) => `Welcome to MediFlow, ${name}!`,
    title:    (name) => `Welcome to MediFlow, ${name}!`,
    body:     'Your pharmacist account is now verified and active. You can view pending prescriptions and manage dispensing from your dashboard.',
    ctaText:  'Go to Dashboard',
    ctaPath:  '/dashboard/pharmacist',
  },
  admin_en: {
    subject:  (name) => `Welcome to MediFlow, ${name}!`,
    title:    (name) => `Welcome to MediFlow, ${name}!`,
    body:     'Your administrator account is now verified and active. You have full access to manage all users, sessions, and platform settings from the admin dashboard.',
    ctaText:  'Go to Admin Dashboard',
    ctaPath:  '/dashboard/admin',
  },
  // Hindi — patient
  patient_hi: {
    subject:  (name) => `MediFlow में आपका स्वागत है, ${name}!`,
    title:    (name) => `स्वागत है, ${name}!`,
    body:     'आपका मरीज़ खाता सत्यापित और सक्रिय हो गया है। आप अपने डैशबोर्ड से स्वास्थ्य रिकॉर्ड, नुस्ख़े, लैब रिपोर्ट और परामर्श इतिहास देख सकते हैं।',
    ctaText:  'डैशबोर्ड पर जाएं',
    ctaPath:  '/dashboard/patient',
  },
  // Telugu — patient
  patient_te: {
    subject:  (name) => `MediFlow కి స్వాగతం, ${name}!`,
    title:    (name) => `స్వాగతం, ${name}!`,
    body:     'మీ రోగి ఖాతా ధృవీకరించబడింది మరియు చురుకుగా ఉంది. మీ డాష్‌బోర్డ్ నుండి ఆరోగ్య రికార్డులు, ప్రిస్క్రిప్షన్లు, లాబ్ నివేదికలు మరియు సంప్రదింపు చరిత్రను యాక్సెస్ చేయవచ్చు.',
    ctaText:  'డాష్‌బోర్డ్‌కు వెళ్ళండి',
    ctaPath:  '/dashboard/patient',
  },
  // Hindi — doctor
  doctor_hi: {
    subject:  (name) => `MediFlow में आपका स्वागत है, डॉ. ${name}!`,
    title:    (name) => `स्वागत है, डॉ. ${name}!`,
    body:     'आपका डॉक्टर खाता सत्यापित और सक्रिय हो गया है। आप अपने डैशबोर्ड से रोगी परामर्श, SOAP नोट्स, दवाइयों का प्रिस्क्रिप्शन और रिकॉर्ड प्रबंधन शुरू कर सकते हैं।',
    ctaText:  'डैशबोर्ड पर जाएं',
    ctaPath:  '/dashboard/doctor',
  },
  // Telugu — doctor
  doctor_te: {
    subject:  (name) => `MediFlow కి స్వాగతం, డా. ${name}!`,
    title:    (name) => `స్వాగతం, డా. ${name}!`,
    body:     'మీ డాక్టర్ ఖాతా ధృవీకరించబడింది మరియు చురుకుగా ఉంది. మీ డాష్‌బోర్డ్ నుండి రోగి సంప్రదింపులు, SOAP నోట్స్, మందులు ప్రిస్క్రిప్షన్ మరియు రికార్డుల నిర్వహణ ప్రారంభించవచ్చు.',
    ctaText:  'డాష్‌బోర్డ్‌కు వెళ్ళండి',
    ctaPath:  '/dashboard/doctor',
  },
  // Hindi — pharmacist
  pharmacist_hi: {
    subject:  (name) => `MediFlow में आपका स्वागत है, ${name}!`,
    title:    (name) => `MediFlow में आपका स्वागत है, ${name}!`,
    body:     'आपका फार्मासिस्ट खाता सत्यापित और सक्रिय हो गया है। आप अपने डैशबोर्ड से लंबित प्रिस्क्रिप्शन देख सकते हैं और दवा वितरण प्रबंधित कर सकते हैं।',
    ctaText:  'डैशबोर्ड पर जाएं',
    ctaPath:  '/dashboard/pharmacist',
  },
  // Telugu — pharmacist
  pharmacist_te: {
    subject:  (name) => `MediFlow కి స్వాగతం, ${name}!`,
    title:    (name) => `MediFlow కి స్వాగతం, ${name}!`,
    body:     'మీ ఫార్మసిస్ట్ ఖాతా ధృవీకరించబడింది మరియు చురుకుగా ఉంది. మీ డాష్‌బోర్డ్ నుండి పెండింగ్ ప్రిస్క్రిప్షన్లు చూడవచ్చు మరియు మందుల పంపిణీని నిర్వహించవచ్చు.',
    ctaText:  'డాష్‌బోర్డ్‌కు వెళ్ళండి',
    ctaPath:  '/dashboard/pharmacist',
  },
  // Hindi — admin
  admin_hi: {
    subject:  (name) => `MediFlow में आपका स्वागत है, ${name}!`,
    title:    (name) => `MediFlow में आपका स्वागत है, ${name}!`,
    body:     'आपका प्रशासक खाता सत्यापित और सक्रिय हो गया है। आपके पास एडमिन डैशबोर्ड से सभी उपयोगकर्ताओं, सत्रों और प्लेटफ़ॉर्म सेटिंग्स का पूर्ण प्रबंधन अधिकार है।',
    ctaText:  'एडमिन डैशबोर्ड पर जाएं',
    ctaPath:  '/dashboard/admin',
  },
  // Telugu — admin
  admin_te: {
    subject:  (name) => `MediFlow కి స్వాగతం, ${name}!`,
    title:    (name) => `MediFlow కి స్వాగతం, ${name}!`,
    body:     'మీ నిర్వాహకుడి ఖాతా ధృవీకరించబడింది మరియు చురుకుగా ఉంది. అడ్మిన్ డాష్‌బోర్డ్ నుండి అన్ని వినియోగదారులు, సెషన్లు మరియు ప్లాట్‌ఫారం సెట్టింగ్‌లను నిర్వహించడానికి మీకు పూర్తి యాక్సెస్ ఉంది.',
    ctaText:  'అడ్మిన్ డాష్‌బోర్డ్‌కు వెళ్ళండి',
    ctaPath:  '/dashboard/admin',
  },
};

// ---------------------------------------------------------------------------

/**
 * Send a 6-digit OTP email for password reset (forgot-password flow).
 * @param {string} toEmail
 * @param {string} otp
 * @param {'en'|'hi'|'te'} [lang='en']
 */
const sendOtpEmail = async (toEmail, otp, lang = 'en') => {
  const effectiveLang = ['hi', 'te'].includes(lang) ? lang : 'en';
  const c = OTP_CONTENT[effectiveLang];
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"MediFlow" <${FROM_ADDRESS}>`,
    to: toEmail,
    subject: c.subject,
    html:
      emailOpen(c.preview, effectiveLang) +
      `
        <!-- Title -->
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${COLORS.textDark};line-height:1.3;">
          ${c.title}
        </h1>
        <p style="margin:0 0 28px;font-size:14px;color:${COLORS.textMuted};line-height:1.6;">
          ${c.body}
        </p>

        <!-- OTP block -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="center" style="background-color:${COLORS.bgOtp};border:1px solid ${COLORS.border};border-radius:10px;padding:28px 0;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${COLORS.textMuted};">${c.otpLabel}</p>
              <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:${COLORS.primary};font-variant-numeric:tabular-nums;">${otp}</span>
            </td>
          </tr>
        </table>

        <!-- Divider -->
        <div style="border-top:1px solid ${COLORS.border};margin:28px 0;"></div>

        <!-- Disclaimer -->
        <p style="margin:0;font-size:13px;color:${COLORS.textMuted};line-height:1.6;">
          ${c.disclaimer}
        </p>
      ` +
      emailClose(effectiveLang),
  });
};

/**
 * Send a signup notification email (NO OTP) immediately after account creation.
 * Just a "Your account is ready — click to activate" email with a branded CTA button.
 * The OTP is only issued later when the user clicks "Activate My Account" on the page.
 *
 * @param {string} toEmail
 * @param {string} name
 * @param {'patient'|'doctor'|'pharmacist'|'admin'} persona
 * @param {'en'|'hi'|'te'} [lang='en']
 */
const sendSignupEmail = async (toEmail, name, persona = 'patient', lang = 'en') => {
  const effectiveLang = ['hi', 'te'].includes(lang) ? lang : 'en';
  const c = SIGNUP_CONTENT[effectiveLang];
  const badge = (PERSONA_BADGE[effectiveLang] || PERSONA_BADGE.en)[persona] || 'Account';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const activationUrl = `${frontendUrl}/reset-password?email=${encodeURIComponent(toEmail)}&lang=${effectiveLang}`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"MediFlow" <${FROM_ADDRESS}>`,
    to: toEmail,
    subject: c.subject(name),
    html:
      emailOpen(c.preview(name), effectiveLang) +
      `
        <!-- Persona badge -->
        <p style="margin:0 0 20px;display:inline-block;font-size:11px;font-weight:600;letter-spacing:1px;
                  text-transform:uppercase;color:${COLORS.primary};background:${COLORS.bgOtp};
                  border:1px solid ${COLORS.border};border-radius:20px;padding:4px 12px;">${badge}</p>

        <!-- Title -->
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:${COLORS.textDark};line-height:1.3;">
          ${c.title()}
        </h1>
        <p style="margin:0 0 10px;font-size:14px;color:${COLORS.textMuted};line-height:1.6;">
          ${c.body1(name)}
        </p>
        <p style="margin:0 0 28px;font-size:14px;color:${COLORS.textMuted};line-height:1.6;">
          ${c.body2}
        </p>

        <!-- CTA button -->
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
          <tr>
            <td align="center" style="background:linear-gradient(135deg,${COLORS.primary},${COLORS.accent});border-radius:8px;">
              <a href="${activationUrl}"
                 style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:0.2px;">
                ${c.linkText} &rarr;
              </a>
            </td>
          </tr>
        </table>

        <!-- Fallback URL -->
        <p style="margin:0 0 0;font-size:11px;word-break:break-all;color:${COLORS.textSubtle};">
          <a href="${activationUrl}" style="color:${COLORS.primary};text-decoration:underline;">${activationUrl}</a>
        </p>

        <!-- Divider -->
        <div style="border-top:1px solid ${COLORS.border};margin:28px 0;"></div>

        <!-- Disclaimer -->
        <p style="margin:0;font-size:13px;color:${COLORS.textMuted};line-height:1.6;">
          ${c.disclaimer}
        </p>
      ` +
      emailClose(effectiveLang),
  });
};

/**
 * Send an account-activation email containing a 6-digit OTP.
 * Called when the user requests activation (clicks "Activate My Account").
 *
 * @param {string} toEmail
 * @param {string} name          - Account holder's display name
 * @param {string} otp           - 6-digit OTP pre-stored in the OTP map
 * @param {'patient'|'doctor'|'pharmacist'|'admin'} persona
 * @param {'en'|'hi'|'te'} [lang='en'] - Only patients may receive non-English
 */
const sendActivationEmail = async (toEmail, name, otp, persona = 'patient', lang = 'en') => {
  const effectiveLang = ['hi', 'te'].includes(lang) ? lang : 'en';
  const c = ACTIVATION_CONTENT[effectiveLang];
  const badge = (PERSONA_BADGE[effectiveLang] || PERSONA_BADGE.en)[persona] || 'Account';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const activationUrl = `${frontendUrl}/reset-password?email=${encodeURIComponent(toEmail)}&lang=${effectiveLang}`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"MediFlow" <${FROM_ADDRESS}>`,
    to: toEmail,
    subject: c.subject(name),
    html:
      emailOpen(c.preview(name), effectiveLang) +
      `
        <!-- Persona badge -->
        <p style="margin:0 0 20px;display:inline-block;font-size:11px;font-weight:600;letter-spacing:1px;
                  text-transform:uppercase;color:${COLORS.primary};background:${COLORS.bgOtp};
                  border:1px solid ${COLORS.border};border-radius:20px;padding:4px 12px;">${badge}</p>

        <!-- Title -->
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:${COLORS.textDark};line-height:1.3;">
          ${c.title(name)}
        </h1>
        <p style="margin:0 0 10px;font-size:14px;color:${COLORS.textMuted};line-height:1.6;">
          ${c.body1(name)}
        </p>
        <p style="margin:0 0 28px;font-size:14px;color:${COLORS.textMuted};line-height:1.6;">
          ${c.body2}
        </p>

        <!-- OTP block -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="center" style="background-color:${COLORS.bgOtp};border:1px solid ${COLORS.border};border-radius:10px;padding:28px 0;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${COLORS.textMuted};">${c.otpLabel}</p>
              <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:${COLORS.primary};font-variant-numeric:tabular-nums;">${otp}</span>
            </td>
          </tr>
        </table>

        <!-- CTA button -->
        <p style="margin:20px 0 12px;font-size:13px;color:${COLORS.textMuted};line-height:1.6;">${c.linkIntro}</p>
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="background:linear-gradient(135deg,${COLORS.primary},${COLORS.accent});border-radius:8px;">
              <a href="${activationUrl}"
                 style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">
                ${c.linkText} &rarr;
              </a>
            </td>
          </tr>
        </table>

        <!-- Fallback URL -->
        <p style="margin:16px 0 0;font-size:11px;word-break:break-all;color:${COLORS.textSubtle};">
          <a href="${activationUrl}" style="color:${COLORS.primary};text-decoration:underline;">${activationUrl}</a>
        </p>

        <!-- Divider -->
        <div style="border-top:1px solid ${COLORS.border};margin:28px 0;"></div>

        <!-- Disclaimer -->
        <p style="margin:0;font-size:13px;color:${COLORS.textMuted};line-height:1.6;">
          ${c.disclaimer}
        </p>
      ` +
      emailClose(effectiveLang),
  });
};

/**
 * Send a branded welcome email after a user successfully sets their password.
 * Different template per persona; patient template honours their language.
 *
 * @param {string} toEmail
 * @param {string} name
 * @param {'patient'|'doctor'|'pharmacist'|'admin'} persona
 * @param {'en'|'hi'|'te'} [lang='en']
 */
const sendWelcomeEmail = async (toEmail, name, persona = 'patient', lang = 'en') => {
  const effectiveLang = ['hi', 'te'].includes(lang) ? lang : 'en';
  const key = `${persona}_${effectiveLang}`;
  const c = WELCOME_CONTENT[key] || WELCOME_CONTENT[`${persona}_en`];
  const badge = (PERSONA_BADGE[effectiveLang] || PERSONA_BADGE.en)[persona] || 'Account';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const dashboardUrl = `${frontendUrl}${c.ctaPath}`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"MediFlow" <${FROM_ADDRESS}>`,
    to: toEmail,
    subject: c.subject(name),
    html:
      emailOpen(c.subject(name), effectiveLang) +
      `


        <!-- Persona badge -->
        <p style="margin:0 0 16px;text-align:center;">
          <span style="display:inline-block;font-size:11px;font-weight:600;letter-spacing:1px;
                       text-transform:uppercase;color:${COLORS.accent};background:rgba(13,155,141,0.08);
                       border:1px solid rgba(13,155,141,0.25);border-radius:20px;padding:4px 14px;">${badge} — ${VERIFIED_LABEL[effectiveLang] || VERIFIED_LABEL.en}</span>
        </p>

        <!-- Title -->
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${COLORS.textDark};line-height:1.3;text-align:center;">
          ${c.title(name)}
        </h1>

        <!-- Body -->
        <p style="margin:0 0 28px;font-size:14px;color:${COLORS.textMuted};line-height:1.7;text-align:center;">
          ${c.body}
        </p>

        <!-- CTA button (centered) -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="center">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:linear-gradient(135deg,${COLORS.primary},${COLORS.accent});border-radius:8px;">
                    <a href="${dashboardUrl}"
                       style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:0.2px;">
                      ${c.ctaText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Divider -->
        <div style="border-top:1px solid ${COLORS.border};margin:28px 0;"></div>

        <p style="margin:0;font-size:12px;color:${COLORS.textSubtle};line-height:1.6;text-align:center;">
          ${NEED_HELP_TEXT[effectiveLang] || NEED_HELP_TEXT.en}
        </p>
      ` +
      emailClose(effectiveLang),
  });
};

// ---------------------------------------------------------------------------
// Multilingual content — Medicine Reminder email
// ---------------------------------------------------------------------------
const MEDICINE_REMINDER_CONTENT = {
  en: {
    subject:      (name) => `Medicine Reminder – Don't Miss Your Dose, ${name}!`,
    preview:      (name) => `Hi ${name}, you have missed medicines from your scheduled slot. Please take them now and mark as taken.`,
    badge:        'Medicine Reminder',
    greeting:     (name) => `Hi ${name},`,
    intro:        'Your scheduled medicine time has passed and the following medicines were not marked as taken. Please take them now if not yet done, and mark them in your dashboard to keep your health records accurate.',
    tableHeadMed: 'Medicine',
    tableHeadDose:'Dosage',
    tableHeadSlot:'Scheduled Slot',
    tableHeadNote:'Instructions',
    actionTitle:  'What should you do?',
    actionBody:   'If you have already taken the medicine, please open your dashboard and mark it as taken. If not, take it now and then mark it.',
    ctaText:      'Go to Medicine Tracker',
    ctaPath:      '/dashboard/patient?tab=medicines',
    disclaimer:   'This is an automated reminder. If you have any concerns about your medication, please consult your doctor.',
    note:         'Staying consistent with your medicines helps you recover faster and stay healthy.',
    slotLabel:    'Slot',
  },
  hi: {
    subject:      (name) => `दवा अनुस्मारक – ${name}, अपनी खुराक न भूलें!`,
    preview:      (name) => `नमस्ते ${name}, आपकी निर्धारित दवाएं छूट गई हैं। कृपया अभी लें और पुष्टि करें।`,
    badge:        'दवा अनुस्मारक',
    greeting:     (name) => `नमस्ते ${name},`,
    intro:        'आपकी निर्धारित दवाओं का समय बीत गया है और निम्नलिखित दवाएं ली गई के रूप में चिह्नित नहीं हैं। यदि आपने अभी तक नहीं ली हैं तो कृपया अभी लें और अपने डैशबोर्ड में इसे अपडेट करें।',
    tableHeadMed: 'दवा',
    tableHeadDose:'खुराक',
    tableHeadSlot:'निर्धारित समय',
    tableHeadNote:'निर्देश',
    actionTitle:  'आपको क्या करना चाहिए?',
    actionBody:   'यदि आपने दवा पहले ही ले ली है, तो अपना डैशबोर्ड खोलें और इसे लिया हुआ चिह्नित करें। यदि नहीं ली है, तो अभी लें और फिर चिह्नित करें।',
    ctaText:      'दवा ट्रैकर पर जाएं',
    ctaPath:      '/dashboard/patient?tab=medicines',
    disclaimer:   'यह एक स्वचालित अनुस्मारक है। यदि आपको अपनी दवाओं के बारे में कोई चिंता है, तो कृपया अपने डॉक्टर से परामर्श करें।',
    note:         'नियमित रूप से दवाएं लेने से आप जल्दी ठीक होते हैं और स्वस्थ रहते हैं।',
    slotLabel:    'समय स्लॉट',
  },
  te: {
    subject:      (name) => `మందుల రిమైండర్ – ${name}, మీ మోతాదు మిస్ చేయకండి!`,
    preview:      (name) => `నమస్కారం ${name}, మీ నిర్ణీత మందులు తీసుకోలేదు. దయచేసి ఇప్పుడు తీసుకుని నిర్ధారించండి.`,
    badge:        'మందుల రిమైండర్',
    greeting:     (name) => `నమస్కారం ${name},`,
    intro:        'మీ నిర్ణీత మందుల సమయం గడిచిపోయింది మరియు ఈ క్రింది మందులు తీసుకున్నట్లు గుర్తించబడలేదు. ఇంకా తీసుకోకపోతే దయచేసి ఇప్పుడే తీసుకుని మీ డాష్‌బోర్డ్‌లో అప్‌డేట్ చేయండి.',
    tableHeadMed: 'మందు',
    tableHeadDose:'మోతాదు',
    tableHeadSlot:'నిర్ణీత సమయం',
    tableHeadNote:'సూచనలు',
    actionTitle:  'మీరు ఏమి చేయాలి?',
    actionBody:   'మీరు ఇప్పటికే మందు తీసుకున్నట్లయితే, మీ డాష్‌బోర్డ్ తెరిచి తీసుకున్నట్లు గుర్తించండి. తీసుకోకపోతే, ఇప్పుడు తీసుకుని గుర్తించండి.',
    ctaText:      'మందుల ట్రాకర్‌కు వెళ్ళండి',
    ctaPath:      '/dashboard/patient?tab=medicines',
    disclaimer:   'ఇది స్వయంచాలక రిమైండర్. మీ మందులపై ఏదైనా సందేహం ఉంటే దయచేసి మీ డాక్టర్‌ను సంప్రదించండి.',
    note:         'నిరంతరం మందులు తీసుకోవడం వల్ల మీరు త్వరగా కోలుకుంటారు మరియు ఆరోగ్యంగా ఉంటారు.',
    slotLabel:    'స్లాట్',
  },
};

/**
 * Send a friendly medicine reminder email when a patient misses a scheduled dose.
 *
 * @param {string} toEmail        - Patient email
 * @param {string} name           - Patient name
 * @param {Array<{name:string,dosage:string,slot:string,instructions:string}>} missedMeds
 * @param {'en'|'hi'|'te'} [lang='en']
 */
const sendMedicineReminderEmail = async (toEmail, name, missedMeds = [], lang = 'en') => {
  const effectiveLang = ['hi', 'te'].includes(lang) ? lang : 'en';
  const c = MEDICINE_REMINDER_CONTENT[effectiveLang];
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const trackerUrl = `${frontendUrl}${c.ctaPath}`;

  // Build medicines table rows
  const tableRows = missedMeds.map((med) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid ${COLORS.border};font-size:13px;font-weight:600;color:${COLORS.textDark};">${med.name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.textMuted};">${med.dosage || '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.textMuted};">${med.slot || '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.textMuted};">${med.instructions || '—'}</td>
    </tr>
  `).join('');

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"MediFlow" <${FROM_ADDRESS}>`,
    to: toEmail,
    subject: c.subject(name),
    html:
      emailOpen(c.preview(name), effectiveLang) +
      `
        <!-- Reminder badge -->
        <p style="margin:0 0 20px;">
          <span style="display:inline-block;font-size:11px;font-weight:600;letter-spacing:1px;
                       text-transform:uppercase;color:#B45309;background:#FEF3C7;
                       border:1px solid #FCD34D;border-radius:20px;padding:4px 14px;">
            ⏰ ${c.badge}
          </span>
        </p>

        <!-- Greeting -->
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:${COLORS.textDark};line-height:1.3;">
          ${c.greeting(name)}
        </h1>
        <p style="margin:0 0 24px;font-size:14px;color:${COLORS.textMuted};line-height:1.7;">
          ${c.intro}
        </p>

        <!-- Missed medicines table -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%"
               style="border:1px solid ${COLORS.border};border-radius:10px;overflow:hidden;margin-bottom:28px;">
          <thead>
            <tr style="background-color:${COLORS.bgOtp};">
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:${COLORS.textMuted};border-bottom:1px solid ${COLORS.border};">${c.tableHeadMed}</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:${COLORS.textMuted};border-bottom:1px solid ${COLORS.border};">${c.tableHeadDose}</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:${COLORS.textMuted};border-bottom:1px solid ${COLORS.border};">${c.tableHeadSlot}</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:${COLORS.textMuted};border-bottom:1px solid ${COLORS.border};">${c.tableHeadNote}</th>
            </tr>
          </thead>
          <tbody style="background-color:${COLORS.bgCard};">
            ${tableRows}
          </tbody>
        </table>

        <!-- Action box -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%"
               style="background-color:#FFF8F0;border:1px solid #FCD34D;border-radius:10px;margin-bottom:28px;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#92400E;">${c.actionTitle}</p>
              <p style="margin:0;font-size:13px;color:#B45309;line-height:1.6;">${c.actionBody}</p>
            </td>
          </tr>
        </table>

        <!-- CTA button -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="center">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:linear-gradient(135deg,${COLORS.primary},${COLORS.accent});border-radius:8px;">
                    <a href="${trackerUrl}"
                       style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:0.2px;">
                      ${c.ctaText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Divider -->
        <div style="border-top:1px solid ${COLORS.border};margin:28px 0;"></div>

        <!-- Health note -->
        <p style="margin:0 0 16px;font-size:13px;color:${COLORS.accent};font-style:italic;text-align:center;line-height:1.6;">
          💊 ${c.note}
        </p>

        <!-- Disclaimer -->
        <p style="margin:0;font-size:12px;color:${COLORS.textSubtle};line-height:1.6;text-align:center;">
          ${c.disclaimer}
        </p>
      ` +
      emailClose(effectiveLang),
  });
};

module.exports = { sendOtpEmail, sendSignupEmail, sendActivationEmail, sendWelcomeEmail, sendMedicineReminderEmail };

