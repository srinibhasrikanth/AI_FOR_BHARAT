import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import QRCode from "react-qr-code";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import HealthChatbot from "@/components/HealthChatbot";
import { formatDOB } from "@/lib/utils";
import { StatCard, StatusBadge, SectionHeader, AvatarCircle } from "@/components/ui/custom-ui";
import {
  LayoutDashboard, FileText, Pill, FlaskConical, Upload, QrCode, Settings,
  AlertTriangle, Clock, MessageCircle, Download, RefreshCw, ClipboardList,
  Plus, Trash2, Phone, User, CheckCircle2, XCircle, AlertCircle, Loader2, ScanLine, CheckCircle, Sun, Sunrise, Sunset, Moon, CalendarDays, Bell, BellRing, X, ChevronLeft, ChevronRight,
  ShoppingCart, Minus, CreditCard, PackageCheck, Search,
} from "lucide-react";
import { mockPatients } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { patientApi } from "@/lib/api";
import { useSearchParams, useNavigate } from "react-router-dom";

const mockPatient = mockPatients[0];

const LANGUAGE_OPTIONS = ["English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Bengali", "Marathi", "Gujarati", "Punjabi", "Urdu", "Odia"];

const DOCUMENT_CATEGORIES = [
  "Blood Test Report",
  "Urine Test Report",
  "X-Ray / Radiology",
  "MRI / CT Scan",
  "Ultrasound Report",
  "ECG / EEG Report",
  "Discharge Summary",
  "Vaccination Record",
  "Allergy Report",
  "Ophthalmology Report",
  "Dental Record",
  "Other",
];

// ── Smart Dose Tracker sub-component ──
interface SlotMed { name: string; dosage: string; frequency: string; duration: string; instructions: string; id: string; durationDays: number; issuedAtMs: number }
interface TimeSlotDef { label: string; key: string; icon: string; window: string; startHour: number; endHour: number }

// Slot time boundaries (24h) for missed-dose detection
const SLOT_BOUNDARIES: Record<string, { start: number; end: number }> = {
  morning: { start: 6, end: 11 },
  afternoon: { start: 12, end: 15 },
  night: { start: 17, end: 20 },
  bedtime: { start: 21, end: 23 },
};

const DoseTracker = ({
  slotMeds,
  timeSlots,
  totalDoses,
  storageKey,
  initialDoses,
  mostRecentDoctorPrescription,
}: {
  slotMeds: Record<string, SlotMed[]>;
  timeSlots: TimeSlotDef[];
  totalDoses: number;
  storageKey: string;
  initialDoses: Record<string, boolean>;
  mostRecentDoctorPrescription: any;
}) => {
  const [takenDoses, setTakenDoses] = useState<Record<string, boolean>>(initialDoses);
  const [confirmUncheck, setConfirmUncheck] = useState<string | null>(null);
  const { t } = useLanguage();
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try { return localStorage.getItem("mediflow_notifications") === "true"; }
    catch { return false; }
  });
  const [notifMessage, setNotifMessage] = useState("");
  const [calendarView, setCalendarView] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });

  // Notification scheduling
  useEffect(() => {
    if (!notificationsEnabled || totalDoses === 0) return;
    if (!("Notification" in window)) return;

    const checkAndNotify = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();

      for (const slot of timeSlots) {
        const boundaries = SLOT_BOUNDARIES[slot.key];
        if (!boundaries) continue;
        const meds = slotMeds[slot.key] || [];
        if (meds.length === 0) continue;

        const untaken = meds.filter((m) => !takenDoses[m.id]);
        if (untaken.length === 0) continue;

        // Notify at the start of each slot window
        if (currentHour === boundaries.start && currentMin === 0) {
          new Notification("Medicine Reminder", {
            body: `Time for your ${slot.label.toLowerCase()} medicines: ${untaken.map((m) => m.name).join(", ")}`,
            icon: "/favicon.ico",
          });
        }
        // Notify 30 min before slot ends if still not taken
        if (currentHour === boundaries.end - 1 && currentMin === 30) {
          new Notification("Medicine Reminder - Don't Miss!", {
            body: `You haven't taken your ${slot.label.toLowerCase()} medicines yet: ${untaken.map((m) => m.name).join(", ")}`,
            icon: "/favicon.ico",
          });
        }
      }
    };

    // Check every minute
    const interval = setInterval(checkAndNotify, 60_000);
    // Also check immediately
    checkAndNotify();
    return () => clearInterval(interval);
  }, [notificationsEnabled, takenDoses, slotMeds, timeSlots, totalDoses]);

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      if (!("Notification" in window)) {
        setNotifMessage("This browser does not support notifications.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setNotificationsEnabled(true);
        setNotifMessage("");
        localStorage.setItem("mediflow_notifications", "true");
        new Notification("Notifications Enabled", { body: "You'll receive medicine reminders at each time slot." });
      } else {
        setNotifMessage("Please allow notifications in your browser settings.");
      }
    } else {
      setNotificationsEnabled(false);
      setNotifMessage("");
      localStorage.setItem("mediflow_notifications", "false");
    }
  };

  const toggleDose = (id: string) => {
    const currentlyTaken = !!takenDoses[id];
    if (currentlyTaken) {
      // Show confirmation before unchecking
      setConfirmUncheck(id);
      return;
    }
    setTakenDoses((prev) => {
      const next = { ...prev, [id]: true };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const confirmUncheckDose = () => {
    if (!confirmUncheck) return;
    setTakenDoses((prev) => {
      const next = { ...prev, [confirmUncheck]: false };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
    setConfirmUncheck(null);
  };

  const takenCount = Object.values(takenDoses).filter(Boolean).length;
  const pct = totalDoses > 0 ? Math.round((takenCount / totalDoses) * 100) : 0;

  // Determine which time slot is "current" based on hour
  const currentHour = new Date().getHours();
  const currentSlotKey =
    currentHour < 11 ? "morning" : currentHour < 15 ? "afternoon" : currentHour < 20 ? "night" : "bedtime";

  // Calculate missed medicines: slot time has passed and medicine wasn't taken
  const missedMeds = useMemo(() => {
    const missed: { med: SlotMed; slotLabel: string }[] = [];
    for (const slot of timeSlots) {
      const boundaries = SLOT_BOUNDARIES[slot.key];
      if (!boundaries) continue;
      // Slot is "passed" if the current hour is beyond the slot end
      if (currentHour <= boundaries.end) continue;
      const meds = slotMeds[slot.key] || [];
      for (const m of meds) {
        if (!takenDoses[m.id]) {
          missed.push({ med: m, slotLabel: slot.label });
        }
      }
    }
    return missed;
  }, [takenDoses, currentHour, slotMeds, timeSlots]);

  // Generate simple month calendar
  const calendarMonth = calendarDate.getMonth();
  const calendarYear = calendarDate.getFullYear();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();
  const todayStr = new Date().toISOString().split("T")[0];
  const selectedStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(calendarDate.getDate()).padStart(2, "0")}`;

  const navigateMonth = (dir: -1 | 1) => {
    setCalendarDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + dir, 1);
      return d;
    });
  };

  const selectCalendarDay = (day: number) => {
    setCalendarDate(new Date(calendarYear, calendarMonth, day));
  };

  // Determine what medicines are scheduled for the selected calendar date
  // (same medicines as today since prescriptions are ongoing)
  const isToday = selectedStr === todayStr;
  const isPast = new Date(calendarYear, calendarMonth, calendarDate.getDate()) < new Date(new Date().setHours(0, 0, 0, 0));
  const selectedDayKey = selectedStr;
  const selectedDaySavedDoses = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(`mediflow_doses_${selectedDayKey}`) || "{}"); }
    catch { return {}; }
  }, [selectedDayKey]);

  return (
    <div className="space-y-6">
      {/* Uncheck confirmation dialog */}
      {confirmUncheck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-heading font-bold text-foreground">{t.patientUnmarkMed}</h3>
              <button onClick={() => setConfirmUncheck(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-muted-foreground">{t.patientUnmarkConfirm}</p>
            </div>
            <div className="px-5 py-3 flex gap-3 border-t border-border">
              <button onClick={() => setConfirmUncheck(null)} className="flex-1 px-4 py-2 text-sm border border-border rounded-md text-muted-foreground hover:text-foreground">{t.cancel}</button>
              <button onClick={confirmUncheckDose} className="flex-1 px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive rounded-md hover:bg-destructive/90">{t.patientUnmarkYes}</button>
            </div>
          </div>
        </div>
      )}

      {/* Today's progress header */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-heading font-bold text-foreground">{t.patientTodaySchedule}</h3>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              {mostRecentDoctorPrescription && (
                <span className="ml-2 text-xs">
                  · Rx updated {new Date(mostRecentDoctorPrescription.updatedAt || mostRecentDoctorPrescription.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCalendarView(!calendarView)}
              title="Calendar view"
              className={`p-2 rounded-md border transition-colors ${calendarView ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              <CalendarDays className="w-4 h-4" />
            </button>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{takenCount}/{totalDoses}</p>
              <p className="text-xs text-muted-foreground">{t.patientDosesTaken}</p>
            </div>
          </div>
        </div>
        <div className="w-full bg-secondary rounded-full h-2.5">
          <div
            className="h-2.5 rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: pct === 100 ? "#22c55e" : pct >= 50 ? "var(--primary)" : "#f59e0b",
            }}
          />
        </div>
        {pct === 100 && totalDoses > 0 && (
          <p className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> {t.patientAllDosesToday}
          </p>
        )}
      </div>

      {/* Missed medicines section */}
      {missedMeds.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h4 className="text-sm font-heading font-bold text-destructive">Missed Medicines ({missedMeds.length})</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3">These medicines were not taken during their scheduled time slot. You can still mark them if taken late.</p>
          <div className="space-y-2">
            {missedMeds.map(({ med, slotLabel }) => {
              const taken = !!takenDoses[med.id];
              return (
                <div key={med.id} className={`flex items-center justify-between py-2.5 px-3 rounded-md ${taken ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800" : "bg-card border border-destructive/20"}`}>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${taken ? "text-green-700 dark:text-green-400 line-through" : "text-foreground"}`}>{med.name}</span>
                    {med.dosage && <span className="text-xs text-muted-foreground ml-2">{med.dosage}</span>}
                    <span className="text-xs text-destructive ml-2">Missed from {slotLabel}</span>
                  </div>
                  <button
                    onClick={() => toggleDose(med.id)}
                    className={`ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      taken
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 hover:bg-green-200"
                        : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    }`}
                  >
                    {taken ? (<><CheckCircle className="w-3.5 h-3.5" /> {t.patientTakenLate}</>) : (<><Clock className="w-3.5 h-3.5" /> {t.patientTake}</>)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar view */}
      {calendarView && (
        <div className="bg-card border border-border rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-heading font-bold text-foreground">{t.patientMedCalendar}</h4>
            <div className="flex items-center gap-2">
              <button onClick={() => navigateMonth(-1)} className="p-1 rounded hover:bg-secondary"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-medium text-foreground min-w-[120px] text-center">
                {new Date(calendarYear, calendarMonth).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </span>
              <button onClick={() => navigateMonth(1)} className="p-1 rounded hover:bg-secondary"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1 text-muted-foreground font-medium">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isSelectedDay = dayStr === selectedStr;
              const isTodayDay = dayStr === todayStr;
              const dayMs = new Date(calendarYear, calendarMonth, day).getTime();

              // A day is "active" only if at least one medicine's course covers it
              const allSlotMeds = Object.values(slotMeds).flat();
              const hasActiveMedsOnDay = allSlotMeds.some((med) => {
                if (!med.durationDays || med.durationDays <= 0) return true; // no limit = always active
                return dayMs >= med.issuedAtMs && dayMs < med.issuedAtMs + med.durationDays * 86_400_000;
              });

              // Check if this day has saved dose data
              let dayDoses: Record<string, boolean> = {};
              try { dayDoses = JSON.parse(localStorage.getItem(`mediflow_doses_${dayStr}`) || "{}"); } catch {}
              const dayTaken = Object.values(dayDoses).filter(Boolean).length;
              const hasDoses = hasActiveMedsOnDay && dayTaken > 0;
              const allTaken = hasActiveMedsOnDay && totalDoses > 0 && dayTaken >= totalDoses;

              return (
                <button
                  key={day}
                  onClick={() => hasActiveMedsOnDay && selectCalendarDay(day)}
                  className={`py-1.5 rounded-md transition-colors relative ${
                    !hasActiveMedsOnDay
                      ? "text-muted-foreground/25 cursor-default"
                      : isSelectedDay
                      ? "bg-primary text-primary-foreground font-bold"
                      : isTodayDay
                      ? "bg-accent text-accent-foreground font-bold ring-1 ring-primary/30"
                      : "hover:bg-secondary text-foreground"
                  }`}
                >
                  {day}
                  {hasActiveMedsOnDay && !hasDoses && !isSelectedDay && !isTodayDay && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-muted-foreground/25" />
                  )}
                  {hasDoses && !isSelectedDay && (
                    <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${allTaken ? "bg-green-500" : "bg-amber-500"}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected day details */}
          <div className="mt-4 border-t border-border pt-4">
            <h5 className="text-xs font-medium text-muted-foreground mb-3">
              {isToday ? "Today" : new Date(calendarYear, calendarMonth, calendarDate.getDate()).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              {!isToday && " — Scheduled Medicines"}
            </h5>
            {totalDoses === 0 ? (
              <p className="text-xs text-muted-foreground">No medicines scheduled.</p>
            ) : (() => {
              const selectedDayMs = new Date(calendarYear, calendarMonth, calendarDate.getDate()).getTime();
              // Filter each slot's medicines to only those active on the selected day
              const activeSlotsOnDay = timeSlots
                .map(({ label, key, icon }) => ({
                  label, key, icon,
                  meds: (slotMeds[key] || []).filter((med) => {
                    if (!med.durationDays || med.durationDays <= 0) return true;
                    return selectedDayMs >= med.issuedAtMs && selectedDayMs < med.issuedAtMs + med.durationDays * 86_400_000;
                  }),
                }))
                .filter(({ meds }) => meds.length > 0);

              if (activeSlotsOnDay.length === 0) {
                return <p className="text-xs text-muted-foreground">No medicines scheduled for this day.</p>;
              }

              const dayDosesForDetail = isToday ? takenDoses : selectedDaySavedDoses;
              return (
                <div className="space-y-3">
                  {activeSlotsOnDay.map(({ label, key, icon, meds }) => (
                    <div key={key}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm">{icon === "morning" ? <Sunrise className="w-3.5 h-3.5 text-amber-500" /> : icon === "afternoon" ? <Sun className="w-3.5 h-3.5 text-yellow-500" /> : icon === "evening" ? <Sunset className="w-3.5 h-3.5 text-orange-500" /> : <Moon className="w-3.5 h-3.5 text-indigo-400" />}</span>
                        <span className="text-xs font-medium text-foreground">{label}</span>
                      </div>
                      <div className="space-y-1 ml-5">
                        {meds.map((m) => {
                          const taken = !!dayDosesForDetail[m.id];
                          return (
                            <div key={m.id} className="flex items-center gap-2 text-xs">
                              <span className={`w-2 h-2 rounded-full ${taken ? "bg-green-500" : isPast && !isToday ? "bg-red-400" : "bg-muted-foreground/30"}`} />
                              <span className={taken ? "text-green-600 line-through" : "text-foreground"}>{m.name}</span>
                              {m.dosage && <span className="text-muted-foreground">{m.dosage}</span>}
                              {m.durationDays > 0 && <span className="text-[10px] text-muted-foreground/60">{m.durationDays}d course</span>}
                              {taken && <span className="text-green-600 text-[10px]">Taken</span>}
                              {!taken && isPast && !isToday && <span className="text-red-500 text-[10px]">Missed</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Time slot cards */}
      {timeSlots.map(({ label, key, icon, window: timeWindow }) => {
        const meds = slotMeds[key] || [];
        if (meds.length === 0) return null;
        const slotTaken = meds.filter((m) => takenDoses[m.id]).length;
        const slotComplete = slotTaken === meds.length;
        const isCurrent = key === currentSlotKey;

        return (
          <div
            key={key}
            className={`bg-card border rounded-lg p-5 shadow-card transition-colors ${
              slotComplete
                ? "border-green-300 bg-green-50/30 dark:bg-green-950/10"
                : isCurrent
                ? "border-primary/50 ring-1 ring-primary/20"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{icon === "morning" ? <Sunrise className="w-5 h-5 text-amber-500" /> : icon === "afternoon" ? <Sun className="w-5 h-5 text-yellow-500" /> : icon === "evening" ? <Sunset className="w-5 h-5 text-orange-500" /> : <Moon className="w-5 h-5 text-indigo-400" />}</span>
                <div>
                  <h4 className="text-sm font-heading font-bold text-foreground flex items-center gap-2">
                    {label}
                    {isCurrent && !slotComplete && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">NOW</span>
                    )}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">{timeWindow}</p>
                </div>
              </div>
              <span className={`text-xs font-medium ${slotComplete ? "text-green-600" : "text-muted-foreground"}`}>
                {slotTaken}/{meds.length} taken
              </span>
            </div>

            <div className="space-y-2">
              {meds.map((m) => {
                const taken = !!takenDoses[m.id];
                return (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-md transition-colors ${
                      taken ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800" : "bg-secondary"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium ${taken ? "text-green-700 dark:text-green-400 line-through" : "text-foreground"}`}>
                        {m.name}
                      </span>
                      {m.dosage && <span className="text-xs text-muted-foreground ml-2">{m.dosage}</span>}
                      {m.frequency && <span className="text-xs text-muted-foreground ml-1">· {m.frequency}</span>}
                      {m.instructions && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{m.instructions}</p>
                      )}
                      {m.duration && <p className="text-[11px] text-muted-foreground">{m.duration} remaining</p>}
                    </div>
                    <button
                      onClick={() => toggleDose(m.id)}
                      className={`ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        taken
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 hover:bg-green-200"
                          : "gradient-primary text-primary-foreground hover:opacity-90"
                      }`}
                    >
                      {taken ? (
                        <><CheckCircle className="w-3.5 h-3.5" /> {t.patientTaken}</>
                      ) : (
                        <><Clock className="w-3.5 h-3.5" /> {t.patientTake}</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {totalDoses === 0 && (
        <div className="bg-card border border-border rounded-lg p-8 shadow-card text-center">
          <Pill className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t.patientNoMedYet}</p>
          <p className="text-xs text-muted-foreground mt-1">{t.patientNoMedYetSub}</p>
        </div>
      )}
    </div>
  );
};

const PatientDashboard = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = searchParams.get("tab") || "overview";
  const { user, accessToken, refreshToken } = useAuth();
  const { t, language } = useLanguage();
  const links = useMemo(() => [
    { label: t.patientOverview, to: "/dashboard/patient", icon: LayoutDashboard },
    { label: t.patientRecords, to: "/dashboard/patient?tab=records", icon: FileText },
    { label: t.patientMedicines, to: "/dashboard/patient?tab=medicines", icon: Pill },
    { label: t.patientPharmacy, to: "/dashboard/patient?tab=pharmacy", icon: ShoppingCart },
    { label: t.patientLabs, to: "/dashboard/patient?tab=labs", icon: FlaskConical },
    { label: t.patientUpload, to: "/dashboard/patient?tab=upload", icon: Upload },
    { label: t.patientQr, to: "/dashboard/patient?tab=qr", icon: QrCode },
    { label: t.patientSettings, to: "/dashboard/patient?tab=settings", icon: Settings },
  ], [t]);

  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [labReports, setLabReports] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [expandedRecordIds, setExpandedRecordIds] = useState<Set<string>>(new Set());
  const [translationCache, setTranslationCache] = useState<Record<string, any>>({});
  const [translatingRecordIds, setTranslatingRecordIds] = useState<Set<string>>(new Set());
  const [sessionNotesCache, setSessionNotesCache] = useState<Record<string, string>>({});

  // ─── Pharmacy state ────────────────────────────────────────────────────────
  const [pharmMedicines,    setPharmMedicines]    = useState<any[]>([]);
  const [pharmLoading,      setPharmLoading]      = useState(false);
  const [pharmSearch,       setPharmSearch]       = useState("");
  const [cart,              setCart]              = useState<Record<string, number>>({});
  const [pharmOrders,       setPharmOrders]       = useState<any[]>([]);
  const [checkoutLoading,   setCheckoutLoading]   = useState(false);
  const [checkoutError,     setCheckoutError]     = useState("");
  const [paidOrder,         setPaidOrder]         = useState<any>(null);
  const [pharmTab,          setPharmTab]          = useState<"shop"|"orders">("shop");
  const [pharmCatFilter,    setPharmCatFilter]    = useState("all");

  const loadPharmacyData = useCallback(async () => {
    if (!accessToken) return;
    setPharmLoading(true);
    try {
      const [medsRes, ordersRes] = await Promise.allSettled([
        patientApi.getMedicines(accessToken),
        patientApi.getOrders(accessToken),
      ]);
      if (medsRes.status === "fulfilled") setPharmMedicines(medsRes.value.data || []);
      if (ordersRes.status === "fulfilled") setPharmOrders(ordersRes.value.data || []);
    } catch (e) { console.error(e); }
    finally { setPharmLoading(false); }
  }, [accessToken]);

  useEffect(() => {
    if (tab === "pharmacy") loadPharmacyData();
  }, [tab, loadPharmacyData]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([medId, qty]) => {
        const med = pharmMedicines.find(m => m._id === medId);
        return med ? { ...med, qty } : null;
      })
      .filter(Boolean) as (any & { qty: number })[];
  }, [cart, pharmMedicines]);

  const cartTotal = useMemo(() => cartItems.reduce((s, i) => s + i.cost * i.qty, 0), [cartItems]);

  const prefillCartFromPrescription = useCallback(() => {
    // Prefer doctor-created prescriptions — explicitly exclude patient_upload
    const doctorRx = prescriptions.find(
      (p: any) =>
        p.data?.source !== 'patient_upload' &&
        p.data?.consultationMedicines?.length > 0 &&
        p.status === "pending"
    );
    const rx = doctorRx || prescriptions.find(
      (p: any) => p.data?.source !== 'patient_upload' && p.status === "pending"
    );
    if (!rx) return;

    const newCart: Record<string, number> = {};
    const consultMeds: any[] = rx.data?.consultationMedicines || [];
    const linkMeds: any[] = rx.medicines || [];

    if (consultMeds.length > 0) {
      // Doctor prescriptions: name-based match against pharmacy inventory
      for (const med of consultMeds) {
        const pharmMed = pharmMedicines.find(
          (pm: any) => pm.name?.toLowerCase() === (med.name || "").toLowerCase()
        );
        if (!pharmMed) continue;
        const times = ["morning", "afternoon", "night", "bedtime"].filter((k) => (med as any)[k]);
        const durationDays = parseInt(med.duration) || 1;
        const qty = durationDays * Math.max(times.length, 1);
        if (qty > 0) newCart[pharmMed._id] = qty;
      }
    } else {
      // Digitized/uploaded prescriptions: ID-based match
      for (const med of linkMeds) {
        const medDoc = med.medicineId;
        const id = medDoc?._id || medDoc;
        if (!id) continue;
        const days = med.durationDays || 1;
        const daily = (med.time || []).filter((t: string) => t !== "sos");
        const qty =
          daily.length === 0 && (med.time || []).includes("sos")
            ? 1
            : days * Math.max(daily.length, 1);
        newCart[id] = qty;
      }
    }
    setCart(newCart);
  }, [prescriptions, pharmMedicines]);

  const pharmCategories = useMemo(() => {
    const cats = [...new Set(pharmMedicines.map(m => m.category))].filter(Boolean).sort();
    return cats;
  }, [pharmMedicines]);

  const filteredPharmMeds = useMemo(() => pharmMedicines.filter(m => {
    if (pharmCatFilter !== "all" && m.category !== pharmCatFilter) return false;
    if (pharmSearch.trim()) {
      const q = pharmSearch.toLowerCase();
      return m.name?.toLowerCase().includes(q) || m.category?.toLowerCase().includes(q);
    }
    return true;
  }), [pharmMedicines, pharmSearch, pharmCatFilter]);

  const handleRazorpayCheckout = useCallback(async () => {
    if (!accessToken || cartItems.length === 0) return;
    setCheckoutLoading(true); setCheckoutError("");
    try {
      // Proactively refresh the token so it's fresh for the payment flow.
      // After refresh(), the new token is in localStorage as "patient_token".
      try { await refreshToken(); } catch { /* session truly expired — will surface as 401 below */ }
      const freshToken = localStorage.getItem("patient_token") || accessToken;
      const mostRecentRx = prescriptions.find((p: any) => p.status === "pending");
      const items = cartItems.map(item => ({
        medicineId:  item._id,
        requiredQty: item.qty,
        isPrescribed: !!(mostRecentRx?.medicines || []).some((m: any) => {
          const id = m.medicineId?._id || m.medicineId;
          return String(id) === String(item._id);
        }),
      }));
      const orderRes = await patientApi.createOrder(freshToken, {
        prescriptionId: mostRecentRx?._id,
        items,
      });
      const { razorpayOrderId, amount, currency, keyId } = orderRes.data;
      await new Promise<void>((resolve, reject) => {
        if ((window as any).Razorpay) { resolve(); return; }
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Razorpay"));
        document.body.appendChild(script);
      });
      await new Promise<void>((resolve, reject) => {
        const options = {
          key:         keyId,
          amount,
          currency,
          name:        "MediFlow Pharmacy",
          description: `Medicine order for ${patient?.name || "Patient"} (${cartItems.length} item${cartItems.length > 1 ? "s" : ""})`,
          order_id:    razorpayOrderId,
          handler:     async (response: any) => {
            try {
              // Re-read the freshest token from localStorage here.
              // The Razorpay modal can stay open for several minutes; during that
              // time the scheduled silent refresh may have rotated the token in
              // localStorage. Using the stale captured `freshToken` would cause
              // a 401 on verifyPayment which previously triggered logout().
              const latestToken = (() => {
                try {
                  const storedUser = localStorage.getItem("mediflow_user");
                  if (storedUser) {
                    const u = JSON.parse(storedUser);
                    return localStorage.getItem(`${u.role}_token`) || freshToken;
                  }
                } catch { /* ignore */ }
                return freshToken;
              })();
              const verRes = await patientApi.verifyPayment(latestToken, {
                razorpayOrderId:   response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              setPaidOrder(verRes.data);
              setCart({});
              await loadPharmacyData();
              resolve();
            } catch (e: any) { reject(e); }
          },
          prefill: {
            name:    patient?.name        || "",
            email:   patient?.email       || "",
            contact: patient?.phoneNumber || "",
          },
          theme: { color: "#7c3aed" },
          modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
        };
        const rp = new (window as any).Razorpay(options);
        rp.open();
      });
    } catch (e: any) {
      if (e?.message !== "Payment cancelled") {
        setCheckoutError(e?.message || "Payment failed. Please try again.");
      }
    } finally {
      setCheckoutLoading(false);
    }
  }, [accessToken, refreshToken, cartItems, patient, prescriptions, loadPharmacyData]);

  const downloadOrderQR = useCallback((order: any) => {
    const svg = document.getElementById(`order-qr-${order._id}`)?.querySelector("svg");
    if (!svg) return;
    const size = 300;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const a = document.createElement("a");
      a.download = `pharmacy-qr-${order.orderId}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }, []);

  // Emergency contacts state (Settings tab)
  type EmergencyContact = { name: string; phoneNumber: string; address: string; relation: string };
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [editLanguages, setEditLanguages] = useState<string[]>([]);
  const [languagesSaved, setLanguagesSaved] = useState(false);

  const toggleRecord = useCallback((id: string) => {
    setExpandedRecordIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Map recordId → prescription so we can show SOAP + history per record
  const prescriptionByRecordId = useMemo(() => {
    const map: Record<string, any> = {};
    for (const p of prescriptions) {
      const rid = p.recordId?._id || p.recordId;
      if (rid) map[String(rid)] = p;
    }
    return map;
  }, [prescriptions]);

  // ─── Record translation (Sarvam AI) ────────────────────────────────────────
  const translateRecord = useCallback(async (record: any, lang: string) => {
    if (!accessToken || lang === "en") return;
    const id = String(record._id);
    const cacheKey = `${id}:${lang}`;
    setTranslatingRecordIds((prev) => { const s = new Set(prev); s.add(id); return s; });
    try {
      const presc = prescriptions
        .find((p: any) => {
          const rid = p.recordId?._id || p.recordId;
          return String(rid) === id;
        });
      const res = await patientApi.translateRecord(accessToken, {
        soapNote: presc?.data?.soapNote || null,
        complaint: record.complaint || "",
        diagnosedComplaint: record.diagnosedComplaint || "",
        icdCodes: presc?.data?.icd10Codes || [],
        consultationMedicines: presc?.data?.consultationMedicines || [],
        patientName: (record.patientId?.name || ""),
        targetLanguage: lang as "hi" | "te",
      });
      setTranslationCache((prev) => ({ ...prev, [cacheKey]: res.data }));
    } catch (e) {
      console.error("[records] Translation failed", e);
    } finally {
      setTranslatingRecordIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  }, [accessToken, prescriptions]);

  // Auto-translate ALL records when language changes (for collapsed header text too)
  useEffect(() => {
    if (language === "en" || records.length === 0) return;
    records.forEach((r: any) => {
      const id = String(r._id);
      const cacheKey = `${id}:${language}`;
      if (!translationCache[cacheKey] && !translatingRecordIds.has(id)) {
        translateRecord(r, language);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, records]);

  // When a record is expanded and not yet translated, trigger translation
  useEffect(() => {
    if (language === "en" || records.length === 0) return;
    expandedRecordIds.forEach((id) => {
      const cacheKey = `${id}:${language}`;
      if (!translationCache[cacheKey] && !translatingRecordIds.has(id)) {
        const record = records.find((r: any) => String(r._id) === id);
        if (record) translateRecord(record, language);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedRecordIds]);

  // Translate session notes when language or sessions change
  useEffect(() => {
    if (language === "en" || sessions.length === 0 || !accessToken) return;
    const notesToTranslate = sessions.filter((s: any) => {
      if (!s.notes) return false;
      const key = `${s._id}:${language}`;
      return !sessionNotesCache[key];
    });
    if (notesToTranslate.length === 0) return;
    (async () => {
      for (const s of notesToTranslate) {
        const key = `${s._id}:${language}`;
        try {
          const res = await patientApi.translateRecord(accessToken, {
            complaint: s.notes,
            targetLanguage: language as "hi" | "te",
          });
          setSessionNotesCache((prev) => ({ ...prev, [key]: res.data.complaint || s.notes }));
        } catch { /* non-critical — fall back to original */ }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, sessions]);

  useEffect(() => {
    const fetchPatientProfile = async () => {
      if (!accessToken) {
        setError("No access token found");
        setLoading(false);
        return;
      }

      try {
        const [profileRes, recordsRes, labsRes, prescriptionsRes, sessionsRes] = await Promise.allSettled([
          patientApi.getProfile(accessToken),
          patientApi.getRecords(accessToken),
          patientApi.getLabReports(accessToken),
          patientApi.getPrescriptions(accessToken),
          patientApi.getSessions(accessToken),
        ]);

        if (profileRes.status === "fulfilled") setPatient(profileRes.value.data);
        else if (user) setPatient(user);

        // Initialise emergency contacts from fetched profile
        if (profileRes.status === "fulfilled") {
          setEmergencyContacts(profileRes.value.data?.emergencyContacts || []);
          setEditLanguages(profileRes.value.data?.languagesKnown || ["English"]);
        } else if (user) {
          setEmergencyContacts((user as any)?.emergencyContacts || []);
          setEditLanguages((user as any)?.languagesKnown || ["English"]);
        }

        if (recordsRes.status === "fulfilled") setRecords(recordsRes.value.data || []);
        if (labsRes.status === "fulfilled") setLabReports(labsRes.value.data || []);
        if (prescriptionsRes.status === "fulfilled") setPrescriptions(prescriptionsRes.value.data || []);
        if (sessionsRes.status === "fulfilled") setSessions(sessionsRes.value.data || []);
      } catch (err: any) {
        console.error("Failed to fetch patient data:", err);
        setError(err.message || "Failed to load data");
        if (user) setPatient(user);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientProfile();
  }, [accessToken, user]);

  // Fix 2: Real-time polling — refresh clinical data every 30 seconds
  useEffect(() => {
    if (!accessToken) return;
    const poll = async () => {
      const [recordsRes, labsRes, prescriptionsRes, sessionsRes] = await Promise.allSettled([
        patientApi.getRecords(accessToken),
        patientApi.getLabReports(accessToken),
        patientApi.getPrescriptions(accessToken),
        patientApi.getSessions(accessToken),
      ]);
      if (recordsRes.status === "fulfilled") setRecords(recordsRes.value.data || []);
      if (labsRes.status === "fulfilled") setLabReports(labsRes.value.data || []);
      if (prescriptionsRes.status === "fulfilled") setPrescriptions(prescriptionsRes.value.data || []);
      if (sessionsRes.status === "fulfilled") setSessions(sessionsRes.value.data || []);
    };
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [accessToken]);

  // Upload tab state — must be declared before any early return
  const [prescFile, setPrescFile]                     = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]                   = useState<string | null>(null);
  const [digitizeState, setDigitizeState]             = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [digitizeResult, setDigitizeResult]           = useState<any>(null);
  const [digitizeError, setDigitizeError]             = useState('');
  const [showReminderConfirm, setShowReminderConfirm] = useState(false);
  const [reminderAdded, setReminderAdded]             = useState(false);
  const [showCartConfirm,    setShowCartConfirm]       = useState(false);
  const [cartAdded,          setCartAdded]             = useState(false);
  const prescInputRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // Maps OCR timing strings → DoseTracker slot keys
  const ocrTimingToSlots = (timing: string[]): Record<string, boolean> => {
    const slots: Record<string, boolean> = {};
    for (const t of timing || []) {
      if (t === 'morning_before_breakfast' || t === 'morning_after_breakfast') slots['morning'] = true;
      else if (t === 'afternoon_before_lunch' || t === 'afternoon_after_lunch') slots['afternoon'] = true;
      else if (t === 'evening') slots['night'] = true;
      else if (t === 'night_before_dinner' || t === 'night_after_dinner') slots['bedtime'] = true;
    }
    return slots;
  };

  const displayPatient = patient || user || mockPatient;

  // Current medication schedule: prefer the most recent doctor-updated prescription's medicines.
  // Fall back to pharmacy prescription medicines if no doctor consultation medicines exist.
  // Explicitly exclude patient_upload source so digitized PDFs never appear
  // in the dose tracker (they use data.digitizedMedicines, not consultationMedicines,
  // but the source check provides an additional safety guard).
  const mostRecentDoctorPrescription = prescriptions.find(
    (p: any) =>
      p.data?.source !== 'patient_upload' &&
      p.data?.consultationMedicines?.length > 0
  );

  // Merge doctor meds with any OCR-sourced reminders the patient explicitly added
  const allMeds: any[] = useMemo(() => {
    const doctorMeds = mostRecentDoctorPrescription
      ? mostRecentDoctorPrescription.data.consultationMedicines
      : [];
    let ocrMeds: any[] = [];
    try {
      ocrMeds = JSON.parse(localStorage.getItem('mediflow_ocr_reminders') || '[]');
    } catch { ocrMeds = []; }
    return [...doctorMeds, ...ocrMeds];
  }, [mostRecentDoctorPrescription, reminderAdded]);

  const downloadQR = useCallback(() => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const size = 300;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const a = document.createElement("a");
      a.download = `emergency-qr-${displayPatient.name || "patient"}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }, [displayPatient.name]);

  if (loading) {
    return (
      <DashboardLayout title="My Dashboard" links={links} userName={user?.name || "Patient"} userAvatar="">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const patientTabTitles: Record<string, string> = {
    overview: t.patientDashTitle,
    records: t.patientRecords,
    medicines: t.patientMedicines,
    pharmacy: t.patientPharmacy,
    labs: t.patientLabs,
    upload: t.patientUpload,
    qr: "",
    settings: t.settingsTitle,
  };
  const pageTitle = patientTabTitles[tab] !== undefined ? patientTabTitles[tab] : tab.charAt(0).toUpperCase() + tab.slice(1);

  return (
    <>
    <DashboardLayout title={pageTitle} links={links} userName={displayPatient.name} userAvatar={displayPatient.avatar || ""}>
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3 text-sm text-destructive mb-4">
          {error}
        </div>
      )}
      


      {tab === "overview" && (
        <div className="space-y-6">
          {/* Profile card */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-card flex items-center gap-4">
            <AvatarCircle initials={displayPatient.avatar || displayPatient.name?.charAt(0) || "P"} size="lg" />
            <div>
              <h2 className="text-xl font-heading font-bold text-foreground">{displayPatient.name}</h2>
              <div className="flex gap-3 text-sm text-muted-foreground mt-1">
                <span>{displayPatient.bloodGroup}</span>
                <span>{displayPatient.age || (() => { const parts = (displayPatient.dob || "").split("-"); const yr = parts.length === 3 ? parseInt(parts[2]) : NaN; return !isNaN(yr) ? new Date().getFullYear() - yr : "—"; })()} years</span>
                <span>{displayPatient.phoneNumber || displayPatient.phone}</span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-lg p-6 shadow-card">
              <SectionHeader title={t.patientActiveMeds} />
              <div className="space-y-3">
                {allMeds.slice(0, 3).map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.medicineId?.name || m.name} {m.dosage}</p>
                      <p className="text-xs text-muted-foreground">{m.frequency} · {m.duration}</p>
                    </div>
                    <div className="flex gap-1">
                      {(m.times?.morning || m.morning) && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">AM</span>}
                      {(m.times?.night || m.night) && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">PM</span>}
                    </div>
                  </div>
                ))}
                {allMeds.length === 0 && <p className="text-sm text-muted-foreground">{t.patientNoRx}</p>}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 shadow-card">
              <SectionHeader title={t.patientAlerts} />
              <div className="space-y-3">
                {labReports.filter((l: any) => l.status === "pending").map((l: any) => (
                  <div key={l._id} className="flex items-center gap-3 py-2 text-sm">
                    <Clock className="w-4 h-4 text-warning" />
                    <span className="text-foreground">{l.testName} — result pending</span>
                  </div>
                ))}
                {(displayPatient.allergies || []).length > 0 && (
                  <div className="flex items-center gap-3 py-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-foreground">Allergies: {displayPatient.allergies?.join(", ")}</span>
                  </div>
                )}
                {labReports.filter((l: any) => l.status === "pending").length === 0 && (displayPatient.allergies || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">{t.patientNoAlerts}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "records" && (
        <div className="space-y-6">
          {/* Consultation Sessions from DB */}
          {sessions.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-6 shadow-card">
              <SectionHeader title={t.recordsConsultationHistory} />
              <div className="space-y-3">
                {sessions.map((s: any) => (
                  <div key={s._id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.doctorId?.name || "Doctor"}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.doctorId?.specialization && `${s.doctorId.specialization} · `}
                        {s.startTimestamp ? new Date(s.startTimestamp).toLocaleDateString() : "—"}
                      </p>
                      {s.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {sessionNotesCache[`${s._id}:${language}`] || s.notes}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-card border border-border rounded-lg p-6 shadow-card">
            <SectionHeader title={t.recordsHealthTimeline} />
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.recordsNoRecords}</p>
          ) : (
            <div className="space-y-4 ml-4 border-l-2 border-accent/30 pl-6">
              {records.map((r: any) => {
                const presc = prescriptionByRecordId[String(r._id)];
                const isExpanded = expandedRecordIds.has(r._id);
                const editHistory: any[] = presc?.data?.editHistory || [];
                const headerTranslation = language !== "en" ? translationCache[`${r._id}:${language}`] : null;
                const isTranslatingHeader = language !== "en" && translatingRecordIds.has(String(r._id));
                return (
                  <div key={r._id} className="relative">
                    <div className="absolute -left-[31px] w-4 h-4 rounded-full gradient-primary border-2 border-card" />
                    <div className="border border-border rounded-lg overflow-hidden">
                      {/* Record header — always visible */}
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/40"
                        onClick={() => toggleRecord(r._id)}
                      >
                        <div>
                          <span className="text-sm font-medium text-foreground">
                            {headerTranslation?.complaint || r.complaint}
                            {isTranslatingHeader && !headerTranslation && (
                              <RefreshCw className="inline w-3 h-3 ml-1 animate-spin text-primary" />
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {r.timestamp ? new Date(r.timestamp).toLocaleDateString() : "—"} · {r.doctorId?.name || "Unknown doctor"}
                          </span>
                          {(headerTranslation?.diagnosedComplaint || r.diagnosedComplaint) && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t.recordsDiagnosis}: {headerTranslation?.diagnosedComplaint || r.diagnosedComplaint}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-primary font-medium">{isExpanded ? "Hide ▲" : "View ▼"}</span>
                      </div>

                      {/* Expanded: vitals + SOAP/translation + edit history */}
                      {isExpanded && (() => {
                        const cached = translationCache[`${r._id}:${language}`];
                        const isTranslating = translatingRecordIds.has(String(r._id));
                        const showTranslated = language !== "en" && cached;
                        return (
                        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4 bg-secondary/20">

                          {/* Translation loading indicator */}
                          {language !== "en" && isTranslating && (
                            <div className="flex items-center gap-2 text-xs text-primary">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>{t.recordsTranslating}</span>
                            </div>
                          )}

                          {/* Vitals row — always original (numbers) */}
                          {r.vitals && Object.values(r.vitals).some(Boolean) && (
                            <div>
                              <p className="text-xs font-medium text-foreground mb-1">{t.recordsVitals}</p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {r.vitals.bp && <div className="text-xs"><span className="text-muted-foreground">BP: </span>{r.vitals.bp}</div>}
                                {r.vitals.hr && <div className="text-xs"><span className="text-muted-foreground">HR: </span>{r.vitals.hr} bpm</div>}
                                {r.vitals.temperature && <div className="text-xs"><span className="text-muted-foreground">Temp: </span>{r.vitals.temperature}°F</div>}
                                {r.vitals.spO2 && <div className="text-xs"><span className="text-muted-foreground">SpO₂: </span>{r.vitals.spO2}%</div>}
                                {r.vitals.weight && <div className="text-xs"><span className="text-muted-foreground">Weight: </span>{r.vitals.weight} kg</div>}
                                {r.vitals.height && <div className="text-xs"><span className="text-muted-foreground">Height: </span>{r.vitals.height} cm</div>}
                              </div>
                            </div>
                          )}

                          {/* Patient-friendly translated summary (non-English with cache) */}
                          {showTranslated && cached.soap ? (
                            <div>
                              <p className="text-xs font-medium text-foreground mb-2">
                                {language === "hi" ? "स्वास्थ्य सारांश" : "ఆరోగ్య సారాంశం"}
                              </p>
                              <div className="space-y-2 text-xs">
                                {(cached.soap.summary_translated || cached.soap.summary) && (
                                  <p className="text-foreground">{cached.soap.summary_translated || cached.soap.summary}</p>
                                )}
                                {(cached.soap.diagnosis_translated || cached.soap.diagnosis) && (
                                  <div>
                                    <span className="font-semibold text-primary">{t.recordsDiagnosis}: </span>
                                    <span className="text-foreground">{cached.soap.diagnosis_translated || cached.soap.diagnosis}</span>
                                  </div>
                                )}
                                {(cached.soap.instructions_translated || cached.soap.instructions) && (
                                  <div>
                                    <span className="font-semibold text-primary">{language === "hi" ? "निर्देश: " : "సూచనలు: "}</span>
                                    <span className="text-foreground">{cached.soap.instructions_translated || cached.soap.instructions}</span>
                                  </div>
                                )}
                                {(cached.soap.followUp_translated || cached.soap.followUp) && (
                                  <div>
                                    <span className="font-semibold text-primary">{language === "hi" ? "फॉलो-अप: " : "ఫాలో-అప్: "}</span>
                                    <span className="text-foreground">{cached.soap.followUp_translated || cached.soap.followUp}</span>
                                  </div>
                                )}
                                {((cached.soap.warnings_translated || cached.soap.warnings) || []).length > 0 && (
                                  <div>
                                    <span className="font-semibold text-destructive">{language === "hi" ? "⚠ चेतावनी: " : "⚠ హెచ్చరికలు: "}</span>
                                    <span className="text-foreground">
                                      {(cached.soap.warnings_translated || cached.soap.warnings || []).join(". ")}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Original SOAP for English or while translation is loading */
                            presc?.data?.soapNote && (
                              <div>
                                <p className="text-xs font-medium text-foreground mb-2">{t.recordsConsultationNotes}</p>
                                <div className="space-y-2">
                                  {["subjective", "objective", "assessment", "plan"].map((key) => {
                                    const val = presc.data.soapNote[key];
                                    if (!val) return null;
                                    return (
                                      <div key={key}>
                                        <span className="text-xs font-semibold text-primary capitalize">{key}: </span>
                                        <span className="text-xs text-foreground">{val}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )
                          )}

                          {/* Prescribed medicines — names stay in English for safety */}
                          {(presc?.data?.consultationMedicines || []).length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-foreground mb-2">{t.recordsPrescribedMedicines}</p>
                              <div className="space-y-1">
                                {presc.data.consultationMedicines.map((m: any, i: number) => {
                                  const translatedMed = showTranslated
                                    ? cached.soap?.medications?.[i]
                                    : null;
                                  return (
                                    <div key={i} className="text-xs space-y-0.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-foreground font-medium">{m.name}</span>
                                        <span className="text-muted-foreground">{m.dosage} · {m.frequency} · {m.duration}</span>
                                        <div className="flex gap-1">
                                          {m.morning && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">M</span>}
                                          {m.afternoon && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">A</span>}
                                          {m.night && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">N</span>}
                                          {m.bedtime && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">B</span>}
                                        </div>
                                      </div>
                                      {translatedMed?.timing_translated && (
                                        <p className="text-muted-foreground pl-1">↳ {translatedMed.timing_translated}</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* ICD-10 codes */}
                          {(presc?.data?.icd10Codes || []).length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-foreground mb-1">{t.recordsIcdCodes}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {presc.data.icd10Codes.map((c: any, i: number) => (
                                  <span key={i} className="text-[10px] font-mono bg-secondary border border-border px-2 py-0.5 rounded" title={c.desc}>{c.code}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Edit history */}
                          {editHistory.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-foreground mb-2">Update History ({editHistory.length})</p>
                              <div className="space-y-2">
                                {[...editHistory].reverse().map((h: any, i: number) => (
                                  <details key={i} className="border border-border rounded-md text-xs">
                                    <summary className="px-3 py-2 cursor-pointer text-muted-foreground flex justify-between">
                                      <span>{h.editNote || "Updated by doctor"}</span>
                                      <span>{new Date(h.editedAt).toLocaleString()}</span>
                                    </summary>
                                    <div className="px-3 pb-3 pt-1 border-t border-border space-y-1 text-muted-foreground">
                                      {h.snapshot?.soapNote?.assessment && <p><span className="font-medium text-foreground">Assessment: </span>{h.snapshot.soapNote.assessment}</p>}
                                      {h.snapshot?.soapNote?.plan && <p><span className="font-medium text-foreground">Plan: </span>{h.snapshot.soapNote.plan}</p>}
                                      {h.snapshot?.vitals?.bp && <p><span className="font-medium text-foreground">BP: </span>{h.snapshot.vitals.bp}</p>}
                                    </div>
                                  </details>
                                ))}
                              </div>
                            </div>
                          )}

                        </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      )}

      {tab === "medicines" && (() => {
        const todayKey = new Date().toISOString().split("T")[0];
        const storageKey = `mediflow_doses_${todayKey}`;

        const TIME_SLOTS: TimeSlotDef[] = [
          { label: "Morning", key: "morning", icon: "morning", window: "6 AM – 11 AM", startHour: 6, endHour: 11 },
          { label: "Afternoon", key: "afternoon", icon: "afternoon", window: "12 PM – 3 PM", startHour: 12, endHour: 15 },
          { label: "Evening", key: "night", icon: "evening", window: "5 PM – 8 PM", startHour: 17, endHour: 20 },
          { label: "Bedtime", key: "bedtime", icon: "bedtime", window: "9 PM – 11 PM", startHour: 21, endHour: 23 },
        ];

        // Prescription start date (used for duration-based calendar highlighting)
        const prescStartMs: number = (() => {
          const src = mostRecentDoctorPrescription?.issuedAt || mostRecentDoctorPrescription?.createdAt;
          const d = src ? new Date(src) : new Date();
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        })();

        // Build slot → medicines map, carrying duration data for the calendar
        const slotMeds: Record<string, SlotMed[]> = {};
        TIME_SLOTS.forEach(({ key }) => { slotMeds[key] = []; });
        allMeds.forEach((m: any, idx: number) => {
          const medName = m.medicineId?.name || m.name || `Medicine ${idx + 1}`;
          const durationDays: number = m.durationDays || (typeof m.duration === "string" ? parseInt(m.duration) || 0 : Number(m.duration) || 0);
          const issuedAtMs: number = prescStartMs;
          TIME_SLOTS.forEach(({ key }) => {
            if (m.times?.[key] || m[key]) {
              slotMeds[key].push({
                name: medName,
                dosage: m.dosage || "",
                frequency: m.frequency || "",
                duration: durationDays ? `${durationDays} days` : (m.duration || ""),
                instructions: m.instructions || "",
                id: `${medName.replace(/\s/g, "_")}_${key}`,
                durationDays,
                issuedAtMs,
              });
            }
          });
        });

        const totalDoses = Object.values(slotMeds).flat().length;

        // Read/write taken state from localStorage
        const getSavedDoses = (): Record<string, boolean> => {
          try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); }
          catch { return {}; }
        };

        return (
          <DoseTracker
            slotMeds={slotMeds}
            timeSlots={TIME_SLOTS}
            totalDoses={totalDoses}
            storageKey={storageKey}
            initialDoses={getSavedDoses()}
            mostRecentDoctorPrescription={mostRecentDoctorPrescription}
          />
        );
      })()}

      {tab === "labs" && (
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <SectionHeader title={t.patientLabs} />
          {labReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.patientNoLabs}</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="pb-2">Test</th><th className="pb-2">Type</th><th className="pb-2">Ordered</th><th className="pb-2">Status</th></tr></thead>
              <tbody>
                {labReports.map((l: any) => (
                  <tr key={l._id} className="border-b border-border last:border-0 zebra-row">
                    <td className="py-2.5 text-foreground">{l.testName}</td>
                    <td className="py-2.5 text-muted-foreground">{l.testType || "—"}</td>
                    <td className="py-2.5 text-muted-foreground">
                      {l.orderedTimestamp ? new Date(l.orderedTimestamp).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2.5"><StatusBadge status={l.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "upload" && (
        <div className="space-y-6">
          <SectionHeader title={t.patientUpload} />

          {/* ── idle: drag-and-drop zone ── */}
          {digitizeState === 'idle' && (
            <div className="bg-card border border-border rounded-lg p-6 shadow-card space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-heading font-semibold text-foreground">Prescription Digitizer</h3>
                  <p className="text-xs text-muted-foreground">AI extracts medicines, dosage, and ICD codes from your prescription image</p>
                </div>
              </div>

              <div
                className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => prescInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f && (f.type.startsWith('image/') || f.type === 'application/pdf')) {
                    setPrescFile(f);
                    setPreviewUrl(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
                  }
                }}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="prescription preview" className="max-h-48 mx-auto rounded-lg object-contain mb-2" />
                ) : prescFile && prescFile.type === 'application/pdf' ? (
                  <div className="flex flex-col items-center gap-2 mb-2">
                    <svg className="w-12 h-12 text-red-400" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/></svg>
                    <p className="text-sm font-medium text-primary">{prescFile.name}</p>
                  </div>
                ) : (
                  <Upload className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                )}
                {!prescFile && (
                  <>
                    <p className="text-sm text-muted-foreground mb-1">Drag & drop or click to browse</p>
                    <p className="text-xs text-muted-foreground">Accepts: JPG, PNG, WEBP, PDF</p>
                  </>
                )}
                {prescFile && !previewUrl && prescFile.type !== 'application/pdf' && (
                  <p className="text-sm font-medium text-primary">{prescFile.name}</p>
                )}
                <input
                  ref={prescInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setPrescFile(f);
                    setPreviewUrl(f && f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
                  }}
                />
              </div>

              <div className="flex justify-end gap-3">
                {prescFile && (
                  <button
                    onClick={() => { setPrescFile(null); setPreviewUrl(null); }}
                    className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-md"
                  >
                    Clear
                  </button>
                )}
                <button
                  disabled={!prescFile}
                  onClick={async () => {
                    if (!prescFile || !accessToken) return;
                    setDigitizeState('loading');
                    setDigitizeError('');
                    try {
                      const res = await patientApi.digitizePrescription(accessToken, prescFile);
                      setDigitizeResult(res.data);
                      setDigitizeState('done');
                      patientApi.getPrescriptions(accessToken)
                        .then((r) => setPrescriptions(r.data || []))
                        .catch(() => {});
                    } catch (err: any) {
                      setDigitizeError(err?.message || 'Digitization failed. Please try again.');
                      setDigitizeState('error');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-md disabled:opacity-40"
                >
                  <ScanLine className="w-4 h-4" /> Digitize Prescription
                </button>
              </div>
            </div>
          )}

          {/* ── loading: step progress ── */}
          {digitizeState === 'loading' && (
            <div className="bg-card border border-border rounded-lg p-10 shadow-card flex flex-col items-center gap-6">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Analysing your prescription…</p>
                <p className="text-xs text-muted-foreground mt-1">Sarvam Vision OCR → Parsing medicines → Matching inventory</p>
              </div>
              <div className="flex gap-6 text-xs text-muted-foreground">
                {['Sarvam Vision OCR', 'Parsing medicines', 'Matching inventory'].map((step, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── error ── */}
          {digitizeState === 'error' && (
            <div className="bg-card border border-destructive/30 rounded-lg p-6 shadow-card space-y-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Digitization failed</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{digitizeError}</p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setDigitizeState('idle'); setDigitizeError(''); }}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-md"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* ── done: structured result ── */}
          {digitizeState === 'done' && digitizeResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-foreground">Prescription digitized successfully</span>
                </div>
                <button
                  onClick={() => {
                    setDigitizeState('idle');
                    setDigitizeResult(null);
                    setPrescFile(null);
                    setPreviewUrl(null);
                  }}
                  className="text-xs text-primary font-medium underline underline-offset-2"
                >
                  Scan another
                </button>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                {previewUrl && (
                  <div className="bg-card border border-border rounded-lg p-4 shadow-card">
                    <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Original Image</p>
                    <img src={previewUrl} alt="prescription" className="w-full rounded-lg object-contain max-h-72" />
                  </div>
                )}

                <div className="space-y-4">
                  {digitizeResult.metadata && (
                    <div className="bg-card border border-border rounded-lg p-4 shadow-card space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Detected Details</p>
                      {(() => {
                        const rows = ([
                          ['Prescribed by', digitizeResult.metadata.prescribedBy],
                          ['Clinic / Hospital', digitizeResult.metadata.clinicName],
                          ['Date', digitizeResult.metadata.date],
                          ['Patient', digitizeResult.metadata.patientName],
                          ['Diagnosis', digitizeResult.metadata.diagnosis],
                        ] as [string, string | null][]).filter(([, value]) => !!value);
                        return rows.length > 0 ? rows.map(([label, value]) => (
                          <div key={label} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="text-foreground font-medium text-right max-w-[60%]">{value}</span>
                          </div>
                        )) : (
                          <p className="text-xs text-muted-foreground italic">Could not extract details from this prescription.</p>
                        );
                      })()}
                    </div>
                  )}

                  {digitizeResult.icd_codes?.length > 0 && (
                    <div className="bg-card border border-border rounded-lg p-4 shadow-card">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">ICD-10 Codes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {digitizeResult.icd_codes.map((c: any, i: number) => (
                          <span key={i} title={c.description} className="text-[10px] font-mono bg-secondary border border-border px-2 py-0.5 rounded">
                            {c.code}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {digitizeResult.medicines?.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-4 shadow-card">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Extracted Medicines</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="pb-2 pr-3">Medicine</th>
                          <th className="pb-2 pr-3">Dosage</th>
                          <th className="pb-2 pr-3">Duration</th>
                          <th className="pb-2 pr-3">Timing</th>
                          <th className="pb-2">Inventory</th>
                        </tr>
                      </thead>
                      <tbody>
                        {digitizeResult.medicines.map((m: any, i: number) => (
                          <tr key={i} className="border-b border-border last:border-0">
                            <td className="py-2.5 pr-3 font-medium text-foreground">{m.name}</td>
                            <td className="py-2.5 pr-3 text-muted-foreground">{m.dosage || '—'}</td>
                            <td className="py-2.5 pr-3 text-muted-foreground">{m.durationDays ? `${m.durationDays}d` : '—'}</td>
                            <td className="py-2.5 pr-3 text-muted-foreground">
                              {(m.timing || []).map((t: string) => (
                                <span key={t} className="inline-block bg-secondary rounded px-1 mr-1 mb-0.5">{t.replace(/_/g, ' ')}</span>
                              ))}
                            </td>
                            <td className="py-2.5">
                              {m.matchConfidence === 'exact' && (
                                <span className="flex items-center gap-1 text-green-600 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> {m.inventoryName}
                                </span>
                              )}
                              {m.matchConfidence === 'partial' && (
                                <span className="flex items-center gap-1 text-amber-600 font-medium">
                                  <AlertCircle className="w-3.5 h-3.5" /> {m.inventoryName}
                                </span>
                              )}
                              {m.matchConfidence === 'none' && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <XCircle className="w-3.5 h-3.5" /> Not in inventory
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {digitizeResult.medicines.some((m: any) => m.matchConfidence === 'none') && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Medicines marked “Not in inventory” were not found in the pharmacy stock. Show this to your pharmacist.
                    </p>
                  )}

                  {/* Add to reminders */}
                  <div className="mt-4 pt-4 border-t border-border">
                    {reminderAdded ? (
                      <div className="flex items-center gap-2 text-green-600 text-xs font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Medicines added to your reminder schedule. Check the Medicines tab.
                      </div>
                    ) : showReminderConfirm ? (
                      <div className="bg-secondary rounded-lg p-4 space-y-3">
                        <p className="text-sm font-medium text-foreground">Add these medicines to your Medicine Reminders?</p>
                        <p className="text-xs text-muted-foreground">They will appear in your daily dose tracker under the Medicines tab.</p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              const toSave = digitizeResult.medicines.map((m: any) => ({
                                name: m.name,
                                dosage: m.dosage || '',
                                duration: String(m.durationDays || ''),
                                durationDays: m.durationDays || 0,
                                instructions: m.instructions || '',
                                _fromOCR: true,
                                ...ocrTimingToSlots(m.timing || []),
                              }));
                              try {
                                const existing = JSON.parse(localStorage.getItem('mediflow_ocr_reminders') || '[]');
                                const existingNames = new Set(existing.map((e: any) => (e.name || '').toLowerCase()));
                                const fresh = toSave.filter((m: any) => !existingNames.has((m.name || '').toLowerCase()));
                                localStorage.setItem('mediflow_ocr_reminders', JSON.stringify([...existing, ...fresh]));
                              } catch {
                                localStorage.setItem('mediflow_ocr_reminders', JSON.stringify(toSave));
                              }
                              setReminderAdded(true);
                              setShowReminderConfirm(false);
                            }}
                            className="px-4 py-2 text-xs font-medium text-primary-foreground gradient-primary rounded-md"
                          >
                            Yes, Add to Reminders
                          </button>
                          <button
                            onClick={() => setShowReminderConfirm(false)}
                            className="px-4 py-2 text-xs font-medium text-muted-foreground bg-background border border-border rounded-md hover:bg-secondary"
                          >
                            No, Skip
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowReminderConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-primary border border-primary/40 rounded-md hover:bg-primary/5 transition-colors"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        Add Medicines to Reminders
                      </button>
                    )}
                  </div>

                  {/* Add to Cart */}
                  <div className="mt-3 pt-3 border-t border-border">
                    {cartAdded ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-600 text-xs font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Medicines added to your cart.
                        </div>
                        <button
                          onClick={() => navigate('?tab=pharmacy')}
                          className="px-3 py-1.5 text-xs font-medium text-primary-foreground gradient-primary rounded-md"
                        >
                          View Cart →
                        </button>
                      </div>
                    ) : showCartConfirm ? (
                      <div className="bg-secondary rounded-lg p-4 space-y-3">
                        <p className="text-sm font-medium text-foreground">Add these medicines to your pharmacy cart?</p>
                        <p className="text-xs text-muted-foreground">We'll match them from the pharmacy inventory. You can review and checkout from the Pharmacy tab.</p>
                        <div className="flex gap-3">
                          <button
                            onClick={async () => {
                              // Ensure pharmacy medicines are loaded
                              if (pharmMedicines.length === 0) await loadPharmacyData();
                              const newCart: Record<string, number> = { ...cart };
                              for (const m of digitizeResult.medicines as any[]) {
                                const match = pharmMedicines.find(
                                  (pm: any) => pm.name?.toLowerCase() === (m.name || '').toLowerCase()
                                );
                                if (!match) continue;
                                const slotsCount = (m.timing || []).filter(
                                  (t: string) => t !== 'sos'
                                ).length || 1;
                                const days = m.durationDays || 1;
                                const qty = days * slotsCount;
                                newCart[match._id] = (newCart[match._id] || 0) + qty;
                              }
                              setCart(newCart);
                              setCartAdded(true);
                              setShowCartConfirm(false);
                            }}
                            className="px-4 py-2 text-xs font-medium text-primary-foreground gradient-primary rounded-md"
                          >
                            Yes, Add to Cart
                          </button>
                          <button
                            onClick={() => setShowCartConfirm(false)}
                            className="px-4 py-2 text-xs font-medium text-muted-foreground bg-background border border-border rounded-md hover:bg-secondary"
                          >
                            No, Skip
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowCartConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-primary border border-primary/40 rounded-md hover:bg-primary/5 transition-colors"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Add Medicines to Cart
                      </button>
                    )}
                  </div>
                </div>
              )}

              {digitizeResult.rawText && (
                <details className="bg-card border border-border rounded-lg shadow-card">
                  <summary className="px-4 py-3 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                    View extracted raw text
                  </summary>
                  <pre className="px-4 pb-4 text-[11px] text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                    {digitizeResult.rawText}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "qr" && (() => {
        const baseUrl = import.meta.env.VITE_APP_URL?.replace(/\/$/, "") || window.location.origin;
        const qrPayload = `${baseUrl}/emergency/${displayPatient._id || displayPatient.id}`;
        return (
          <div className="bg-card border border-border rounded-lg p-6 shadow-card max-w-lg mx-auto text-center">
            <h2 className="text-lg font-heading font-bold text-foreground mb-1">{t.patientEmergencyQr}</h2>
            <p className="text-xs text-muted-foreground mb-4">This QR contains your medical details. Show it to emergency responders or your doctor.</p>
            <div ref={qrRef} className="flex items-center justify-center bg-white rounded-xl p-4 w-fit mx-auto mb-6 shadow-sm">
              <QRCode value={qrPayload} size={220} level="M" />
            </div>
            <div className="text-left bg-secondary rounded-lg p-4 space-y-2 text-sm mb-6">
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="text-foreground font-medium">{displayPatient.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Blood Group</span><span className="text-foreground font-medium">{displayPatient.bloodGroup || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Gender</span><span className="text-foreground font-medium">{displayPatient.gender || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="text-foreground font-medium">{displayPatient.phoneNumber || displayPatient.phone || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Allergies</span><span className="text-foreground font-medium">{(displayPatient.allergies || []).join(", ") || "None"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Conditions</span><span className="text-foreground font-medium">{(displayPatient.conditions || []).join(", ") || "None"}</span></div>
              {emergencyContacts.length > 0 && emergencyContacts.map((ec, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">Emergency {emergencyContacts.length > 1 ? `Contact ${i + 1}` : "Contact"}</span>
                  <span className="text-foreground font-medium text-right">{ec.name} ({ec.relation || "—"}) &middot; {ec.phoneNumber}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={downloadQR} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-foreground gradient-primary rounded-md"><Download className="w-4 h-4" /> Download QR</button>
            </div>
            <div className="mt-6 bg-warning/10 border border-warning/30 rounded-md p-3 text-xs text-warning-foreground text-left">
              <AlertTriangle className="w-4 h-4 inline mr-1" /> Keep this QR accessible. Show it to emergency responders.
            </div>
          </div>
        );
      })()}

      {tab === "settings" && (
        <div className="space-y-6 max-w-2xl">
          {/* Profile overview (read-only) */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-card">
            <SectionHeader title={t.profile} />
            <div className="space-y-2 text-sm">
              {([
                [t.name, displayPatient.name],
                [t.email, displayPatient.email],
                [t.phone, displayPatient.phoneNumber || displayPatient.phone],
                [t.dob, formatDOB(displayPatient.dob)],
                [t.gender, displayPatient.gender],
                [t.bloodGroup, displayPatient.bloodGroup],
              ] as [string, string | undefined][]).map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-foreground font-medium">{value || "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Languages Known editor */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-card">
            <SectionHeader title="Languages Known" />
            <p className="text-xs text-muted-foreground mb-3">Select all languages you can communicate in. At least one is required.</p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((lang) => {
                const selected = editLanguages.includes(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() =>
                      setEditLanguages((prev) =>
                        selected ? (prev.length > 1 ? prev.filter((l) => l !== lang) : prev) : [...prev, lang]
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selected
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-background border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                disabled={settingsSaving || editLanguages.length === 0}
                onClick={async () => {
                  if (!accessToken) return;
                  setSettingsSaving(true);
                  setSettingsError("");
                  setSettingsSaved(false);
                  setLanguagesSaved(false);
                  try {
                    const res = await patientApi.updateProfile(accessToken, { languagesKnown: editLanguages });
                    setPatient(res.data);
                    setEditLanguages(res.data?.languagesKnown || editLanguages);
                    setLanguagesSaved(true);
                    setTimeout(() => setLanguagesSaved(false), 3000);
                  } catch (err: any) {
                    setSettingsError(err?.message || "Failed to save languages.");
                  } finally {
                    setSettingsSaving(false);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-primary-foreground gradient-primary rounded-md disabled:opacity-40"
              >
                {settingsSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {t.save}
              </button>
            </div>
            {languagesSaved && (
              <p className="mt-3 text-xs text-primary font-medium">Languages saved successfully.</p>
            )}
          </div>

          {/* Emergency contacts editor */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-heading font-semibold text-foreground">Emergency Contacts</h3>
                <p className="text-xs text-muted-foreground mt-0.5">These contacts are included in your Emergency QR scan.</p>
              </div>
              {emergencyContacts.length < 3 && (
                <button
                  onClick={() => setEmergencyContacts((prev) => [...prev, { name: "", phoneNumber: "", address: "", relation: "" }])}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/40 rounded-md hover:bg-primary/5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Contact
                </button>
              )}
            </div>

            {emergencyContacts.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-border rounded-lg">
                <Phone className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No emergency contacts added yet.</p>
                <button
                  onClick={() => setEmergencyContacts([{ name: "", phoneNumber: "", address: "", relation: "" }])}
                  className="mt-3 text-xs text-primary font-medium underline underline-offset-2"
                >
                  Add your first contact
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {emergencyContacts.map((contact, i) => (
                  <div key={i} className="border border-border rounded-lg p-4 space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact {i + 1}</p>
                      <button
                        onClick={() => setEmergencyContacts((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-destructive hover:bg-destructive/10 rounded p-0.5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Full Name *</label>
                        <input
                          value={contact.name}
                          onChange={(e) => setEmergencyContacts((prev) => prev.map((c, idx) => idx === i ? { ...c, name: e.target.value } : c))}
                          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Phone Number *</label>
                        <input
                          value={contact.phoneNumber}
                          onChange={(e) => setEmergencyContacts((prev) => prev.map((c, idx) => idx === i ? { ...c, phoneNumber: e.target.value } : c))}
                          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Relation</label>
                        <input
                          value={contact.relation}
                          onChange={(e) => setEmergencyContacts((prev) => prev.map((c, idx) => idx === i ? { ...c, relation: e.target.value } : c))}
                          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Address</label>
                        <input
                          value={contact.address}
                          onChange={(e) => setEmergencyContacts((prev) => prev.map((c, idx) => idx === i ? { ...c, address: e.target.value } : c))}
                          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Feedback */}
            {settingsError && (
              <p className="mt-4 text-xs text-destructive flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{settingsError}</p>
            )}
            {settingsSaved && (
              <p className="mt-4 text-xs text-primary font-medium">Emergency contacts saved successfully.</p>
            )}

            {/* Save button */}
            <div className="mt-5 flex justify-end">
              <button
                disabled={settingsSaving || emergencyContacts.some((c) => !c.name.trim() || !c.phoneNumber.trim())}
                onClick={async () => {
                  if (!accessToken) return;
                  setSettingsSaving(true);
                  setSettingsError("");
                  setSettingsSaved(false);
                  try {
                    const res = await patientApi.updateProfile(accessToken, { emergencyContacts });
                    setPatient(res.data);
                    setEmergencyContacts(res.data?.emergencyContacts || emergencyContacts);
                    setSettingsSaved(true);
                    setTimeout(() => setSettingsSaved(false), 3000);
                  } catch (err: any) {
                    setSettingsError(err?.message || "Failed to save. Please try again.");
                  } finally {
                    setSettingsSaving(false);
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-primary-foreground gradient-primary rounded-md disabled:opacity-40"
              >
                {settingsSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {t.settingsSaveChanges}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ════ PHARMACY TAB ════ */}
      {tab === "pharmacy" && (
        <div className="space-y-4">
          {/* Sub-tab toggles */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
            <button onClick={() => setPharmTab("shop")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                pharmTab === "shop" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              <ShoppingCart className="w-4 h-4 inline mr-1.5 -mt-0.5" />{t.patientPharmShop}
            </button>
            <button onClick={() => setPharmTab("orders")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                pharmTab === "orders" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              <PackageCheck className="w-4 h-4 inline mr-1.5 -mt-0.5" />{t.patientPharmMyOrders}
            </button>
          </div>

          {pharmTab === "shop" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* ── Medicine list ── */}
              <div className="lg:col-span-2 space-y-3">
                {/* Pre-fill prompt — only for doctor prescriptions, never for uploaded PDFs */}
                {prescriptions.find(p => p.data?.source !== 'patient_upload' && p.data?.consultationMedicines?.length > 0 && p.status === "pending") && (
                  <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <ClipboardList className="w-4 h-4" />
                      <span>{t.patientPrefillPrompt}</span>
                    </div>
                    <button onClick={prefillCartFromPrescription}
                      className="px-3 py-1.5 text-xs font-semibold text-primary-foreground gradient-primary rounded-lg">
                      {t.patientPrefillBtn}
                    </button>
                  </div>
                )}

                {/* Search + filter */}
                <div className="flex gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input value={pharmSearch} onChange={e => setPharmSearch(e.target.value)}
                      placeholder={t.patientPharmacy + "…"}
                      className="w-full pl-9 pr-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <select value={pharmCatFilter} onChange={e => setPharmCatFilter(e.target.value)}
                    className="px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none">
                    <option value="all">{t.patientPharmAllCat}</option>
                    {pharmCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {pharmLoading ? (
                  <div className="flex justify-center py-10"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>
                ) : filteredPharmMeds.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-10 text-center shadow-card">
                    <Pill className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{t.patientPharmNoMeds}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredPharmMeds.map(med => {
                      const qty = cart[med._id] || 0;
                      return (
                        <div key={med._id} className={`bg-card border rounded-xl p-4 shadow-card transition-all ${
                          qty > 0 ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
                        }`}>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-foreground text-sm">{med.name}</p>
                              <p className="text-xs text-muted-foreground">{med.category} · {med.dosage}</p>
                            </div>
                            <span className="text-sm font-bold text-foreground">₹{med.cost}</span>
                          </div>
                          {med.manufacturer && <p className="text-xs text-muted-foreground mb-2">{med.manufacturer}</p>}
                          <div className="flex items-center justify-between mt-3">
                            <span className={`text-xs font-medium ${
                              med.quantity < 10 ? "text-warning" : "text-muted-foreground"
                            }`}>{med.quantity} in stock</span>
                            {qty === 0 ? (
                              <button
                                onClick={() => setCart(c => ({ ...c, [med._id]: 1 }))}
                                className="px-3 py-1.5 text-xs font-semibold text-primary-foreground gradient-primary rounded-lg flex items-center gap-1.5">
                                <Plus className="w-3.5 h-3.5" /> Add
                              </button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button onClick={() => setCart(c => ({ ...c, [med._id]: Math.max(0, (c[med._id] || 0) - 1) }))}
                                  className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-sm font-bold text-foreground w-5 text-center">{qty}</span>
                                <button onClick={() => setCart(c => ({ ...c, [med._id]: Math.min(med.quantity, (c[med._id] || 0) + 1) }))}
                                  className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Cart ── */}
              <div className="lg:col-span-1">
                <div className="bg-card border border-border rounded-xl p-5 shadow-card sticky top-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                    <h3 className="font-heading font-bold text-foreground">{t.patientCartTitle}</h3>
                    {cartItems.length > 0 && (
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{cartItems.length} item{cartItems.length > 1 ? "s" : ""}</span>
                    )}
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="py-8 text-center">
                      <ShoppingCart className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground">{t.patientPharmCartEmpty}</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {cartItems.map(item => (
                          <div key={item._id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{item.dosage} · ₹{item.cost} × {item.qty}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <span className="text-sm font-semibold text-foreground">₹{(item.cost * item.qty).toFixed(0)}</span>
                              <button onClick={() => setCart(c => { const n = {...c}; delete n[item._id]; return n; })}
                                className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-3 border-t border-border">
                        <div className="flex justify-between text-sm font-semibold mb-4">
                          <span className="text-foreground">Total</span>
                          <span className="text-foreground">₹{cartTotal.toFixed(2)}</span>
                        </div>
                        {checkoutError && (
                          <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-3">{checkoutError}</p>
                        )}
                        <button onClick={handleRazorpayCheckout} disabled={checkoutLoading}
                          className="w-full py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                          {checkoutLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                          Pay ₹{cartTotal.toFixed(2)}
                        </button>
                        <button onClick={() => setCart({})}
                          className="w-full mt-2 py-2 text-xs text-muted-foreground hover:text-foreground text-center">Clear cart</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Paid Order QR success banner ── */}
          {paidOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-7 h-7 text-green-600" />
                  </div>
                  <h2 className="text-lg font-heading font-bold text-foreground">Payment Successful!</h2>
                  <p className="text-sm text-muted-foreground mt-1">Show this QR at the pharmacy counter to collect your medicines.</p>
                </div>
                <div id={`order-qr-${paidOrder._id}`} className="flex justify-center p-4 bg-white rounded-xl border border-border">
                  <QRCode value={paidOrder.qrToken || paidOrder.orderId} size={180} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-mono text-muted-foreground">{paidOrder.orderId}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">₹{(paidOrder.total || 0).toFixed(2)} paid · {paidOrder.items?.length} item{paidOrder.items?.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => downloadOrderQR(paidOrder)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
                    <Download className="w-4 h-4" /> Save QR
                  </button>
                  <button onClick={() => { setPaidOrder(null); setPharmTab("orders"); }}
                    className="flex-1 py-2.5 text-sm font-semibold text-primary-foreground gradient-primary rounded-lg">
                    View Orders
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Orders list ── */}
          {pharmTab === "orders" && (
            <div className="space-y-3">
              {pharmLoading ? (
                <div className="flex justify-center py-10"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>
              ) : pharmOrders.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-10 text-center shadow-card">
                  <PackageCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No orders yet.</p>
                </div>
              ) : pharmOrders.map(order => (
                <div key={order._id} className="bg-card border border-border rounded-xl p-5 shadow-card space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{order.orderId}</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">₹{(order.total || 0).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{order.items?.length} item{order.items?.length !== 1 ? "s" : ""} · {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                      order.status === "dispensed" ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                      : order.status === "paid"     ? "bg-primary/10 text-primary border-primary/20"
                      : order.status === "cancelled"? "bg-destructive/10 text-destructive border-destructive/20"
                      : "bg-muted text-muted-foreground border-border"
                    }`}>{order.status.replace("_"," ")}</span>
                  </div>

                  {/* Show QR if paid but not yet dispensed */}
                  {order.status === "paid" && order.qrToken && (
                    <div className="border border-primary/20 rounded-xl p-4 bg-primary/5">
                      <p className="text-xs text-primary font-medium mb-3 flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5" /> Show this QR at the pharmacy counter
                      </p>
                      <div id={`order-qr-${order._id}`} className="flex justify-center p-3 bg-white rounded-lg border border-border">
                        <QRCode value={order.qrToken} size={160} />
                      </div>
                      <button onClick={() => downloadOrderQR(order)}
                        className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
                        <Download className="w-3.5 h-3.5" /> Download QR
                      </button>
                    </div>
                  )}

                  {/* Items summary */}
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {(order.items || []).slice(0, 3).map((item: any, i: number) => (
                      <p key={i}>{item.name} × {item.requiredQty} — ₹{(item.unitPrice * item.requiredQty).toFixed(0)}</p>
                    ))}
                    {(order.items || []).length > 3 && <p>+{order.items.length - 3} more…</p>}
                  </div>

                  {order.status === "dispensed" && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <PackageCheck className="w-3.5 h-3.5" /> Dispensed on {order.dispensedAt ? new Date(order.dispensedAt).toLocaleDateString() : "—"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </DashboardLayout>
    <HealthChatbot patient={patient} />
    </>
  );
};

export default PatientDashboard;
