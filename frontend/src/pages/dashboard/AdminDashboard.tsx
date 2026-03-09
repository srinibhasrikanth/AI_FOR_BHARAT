import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard, StatusBadge, SectionHeader, EmptyState } from "@/components/ui/custom-ui";
import { LayoutDashboard, Users, UserCheck, Pill, CalendarDays, BarChart3, Settings, Search, Plus, XCircle, Inbox, X, RefreshCw, Trash2 } from "lucide-react";
import { authApi, adminApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSearchParams } from "react-router-dom";

const languageOptions = ["English", "Hindi", "Telugu"];
const bloodGroupOptions = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const genderOptions = ["male", "female", "other", "prefer_not_to_say"] as const;
const specializationOptions = [
  "Cardiology", "Dermatology", "Endocrinology", "Gastroenterology",
  "General Medicine", "General Surgery", "Gynecology & Obstetrics",
  "Neurology", "Oncology", "Ophthalmology", "Orthopedics",
  "Pediatrics", "Psychiatry", "Pulmonology", "Radiology",
  "Urology", "ENT", "Nephrology", "Rheumatology", "Internal Medicine",
];
const designationOptions = [
  "Pharmacist", "Senior Pharmacist", "Chief Pharmacist",
  "Clinical Pharmacist", "Hospital Pharmacist", "Retail Pharmacist",
  "Compounding Pharmacist", "Consultant Pharmacist",
];

const emptyDoctorForm = { name: "", email: "", dob: "", specialization: "", phoneNumber: "", languagesKnown: ["English"], preferredLanguage: "English" };
const langToCode: Record<string, string> = { English: "en", Hindi: "hi", Telugu: "te" };
const emptyPharmacistForm = { name: "", email: "", designation: "", phoneNumber: "", languagesKnown: ["English"], preferredLanguage: "English" };
const emptyPatientForm = { name: "", email: "", gender: "" as any, bloodGroup: "" as any, phoneNumber: "", dob: "", languagesKnown: ["English"], preferredLanguage: "English" };

// (links defined inside component for i18n)

const AdminDashboard = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "overview";
  const { accessToken, user } = useAuth();
  const { t } = useLanguage();
  const links = useMemo(() => [
    { label: t.adminOverview, to: "/dashboard/admin", icon: LayoutDashboard },
    { label: t.adminDoctors, to: "/dashboard/admin?tab=doctors", icon: UserCheck },
    { label: t.adminPatients, to: "/dashboard/admin?tab=patients", icon: Users },
    { label: t.adminPharmacists, to: "/dashboard/admin?tab=pharmacists", icon: Pill },
    { label: t.adminSessions, to: "/dashboard/admin?tab=sessions", icon: CalendarDays },
    { label: t.adminReports, to: "/dashboard/admin?tab=reports", icon: BarChart3 },
    { label: t.adminSettings, to: "/dashboard/admin?tab=settings", icon: Settings },
  ], [t]);

  // Data state
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [pharmacists, setPharmacists] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [pharmacistSearch, setPharmacistSearch] = useState("");

  // Doctor modal
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [doctorForm, setDoctorForm] = useState({ ...emptyDoctorForm });
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorError, setDoctorError] = useState("");
  const [doctorSuccess, setDoctorSuccess] = useState("");

  // Pharmacist modal
  const [showPharmacistModal, setShowPharmacistModal] = useState(false);
  const [pharmacistForm, setPharmacistForm] = useState({ ...emptyPharmacistForm });
  const [pharmacistLoading, setPharmacistLoading] = useState(false);
  const [pharmacistError, setPharmacistError] = useState("");
  const [pharmacistSuccess, setPharmacistSuccess] = useState("");

  // Patient modal
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [patientForm, setPatientForm] = useState({ ...emptyPatientForm });
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError] = useState("");
  const [patientSuccess, setPatientSuccess] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'doctor' | 'patient' | 'pharmacist'; id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Fetch data on mount and when token is available
  useEffect(() => {
    if (accessToken) {
      fetchAllData();
    }
  }, [accessToken]);

  const fetchAllData = async () => {
    if (!accessToken) return;
    setLoading(true);
    setDataError("");
    try {
      const [doctorsRes, patientsRes, pharmacistsRes, sessionsRes] = await Promise.all([
        adminApi.getAllDoctors(accessToken).catch(() => ({ data: [] })),
        adminApi.getAllPatients(accessToken).catch(() => ({ data: [] })),
        adminApi.getAllPharmacists(accessToken).catch(() => ({ data: [] })),
        adminApi.getAllSessions(accessToken).catch(() => ({ data: [] })),
      ]);
      setDoctors(doctorsRes.data || []);
      setPatients(patientsRes.data || []);
      setPharmacists(pharmacistsRes.data || []);
      setSessions(sessionsRes.data || []);
    } catch (err: any) {
      console.error("Failed to fetch data:", err);
      setDataError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setDoctorLoading(true);
    setDoctorError("");
    setDoctorSuccess("");
    try {
      const [dy, dm, dd] = (doctorForm.dob || "").split("-");
      const doctorDob = dd && dm && dy ? `${dd}-${dm}-${dy}` : doctorForm.dob;
      await authApi.registerDoctor({
        name: doctorForm.name,
        email: doctorForm.email,
        dob: doctorDob,
        specialization: doctorForm.specialization,
        phoneNumber: doctorForm.phoneNumber || undefined,
        languagesKnown: doctorForm.languagesKnown,
        preferredLanguage: langToCode[doctorForm.preferredLanguage] || "en",
      });
      setDoctorSuccess("Doctor account created! A password setup link has been emailed to the doctor.");
      setDoctorForm({ ...emptyDoctorForm });
      // Refresh data
      fetchAllData();
      // Close modal after 1.5 seconds
      setTimeout(() => setShowDoctorModal(false), 1500);
    } catch (err: any) {
      setDoctorError(err.message || "Failed to create doctor.");
    } finally {
      setDoctorLoading(false);
    }
  };

  const handleAddPharmacist = async (e: React.FormEvent) => {
    e.preventDefault();
    setPharmacistLoading(true);
    setPharmacistError("");
    setPharmacistSuccess("");
    try {
      await authApi.registerPharmacist({
        name: pharmacistForm.name,
        email: pharmacistForm.email,
        designation: pharmacistForm.designation,
        phoneNumber: pharmacistForm.phoneNumber,
        languagesKnown: pharmacistForm.languagesKnown,
        preferredLanguage: langToCode[pharmacistForm.preferredLanguage] || "en",
      });
      setPharmacistSuccess("Pharmacist account created! A password setup link has been emailed to the pharmacist.");
      setPharmacistForm({ ...emptyPharmacistForm });
      // Refresh data
      fetchAllData();
      // Close modal after 1.5 seconds
      setTimeout(() => setShowPharmacistModal(false), 1500);
    } catch (err: any) {
      setPharmacistError(err.message || "Failed to create pharmacist.");
    } finally {
      setPharmacistLoading(false);
    }
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setPatientLoading(true);
    setPatientError("");
    setPatientSuccess("");
    try {
      const [py, pm, pd] = (patientForm.dob || "").split("-");
      const patientDob = pd && pm && py ? `${pd}-${pm}-${py}` : patientForm.dob;
      await authApi.registerPatient({
        name: patientForm.name,
        email: patientForm.email,
        gender: patientForm.gender,
        bloodGroup: patientForm.bloodGroup,
        phoneNumber: patientForm.phoneNumber,
        dob: patientDob,
        languagesKnown: patientForm.languagesKnown,
        preferredLanguage: langToCode[patientForm.preferredLanguage] || "en",
      });
      setPatientSuccess("Patient account created! A password setup link has been emailed to the patient.");
      setPatientForm({ ...emptyPatientForm });
      // Refresh data
      fetchAllData();
      // Close modal after 1.5 seconds
      setTimeout(() => setShowPatientModal(false), 1500);
    } catch (err: any) {
      setPatientError(err.message || "Failed to create patient.");
    } finally {
      setPatientLoading(false);
    }
  };

  const handleDeleteDoctor = async (id: string, name: string) => {
    setDeleteConfirm({ type: 'doctor', id, name });
    setDeleteError("");
  };

  const handleDeletePatient = async (id: string, name: string) => {
    setDeleteConfirm({ type: 'patient', id, name });
    setDeleteError("");
  };

  const handleDeletePharmacist = async (id: string, name: string) => {
    setDeleteConfirm({ type: 'pharmacist', id, name });
    setDeleteError("");
  };

  const executeDelete = async () => {
    if (!deleteConfirm || !accessToken) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      if (deleteConfirm.type === 'doctor') await adminApi.deleteDoctor(accessToken, deleteConfirm.id);
      else if (deleteConfirm.type === 'patient') await adminApi.deletePatient(accessToken, deleteConfirm.id);
      else await adminApi.deletePharmacist(accessToken, deleteConfirm.id);
      setDeleteConfirm(null);
      fetchAllData();
    } catch (err: any) {
      setDeleteError(err.message || `Failed to delete ${deleteConfirm.type}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleDoctorLang = (lang: string) => {
    setDoctorForm((prev) => {
      const isRemoving = prev.languagesKnown.includes(lang);
      const newLangs = isRemoving
        ? prev.languagesKnown.filter((l) => l !== lang)
        : [...prev.languagesKnown, lang];
      // If removing the preferred language, reset to first remaining language
      const newPref = isRemoving && prev.preferredLanguage === lang
        ? (newLangs[0] || "")
        : prev.preferredLanguage;
      return { ...prev, languagesKnown: newLangs, preferredLanguage: newPref };
    });
  };

  const togglePatientLang = (lang: string) => {
    setPatientForm((prev) => ({
      ...prev,
      languagesKnown: prev.languagesKnown.includes(lang)
        ? prev.languagesKnown.filter((l) => l !== lang)
        : [...prev.languagesKnown, lang],
    }));
  };

  const togglePharmacistLang = (lang: string) => {
    setPharmacistForm((prev) => {
      const isRemoving = prev.languagesKnown.includes(lang);
      const newLangs = isRemoving
        ? prev.languagesKnown.filter((l) => l !== lang)
        : [...prev.languagesKnown, lang];
      const newPref = isRemoving && prev.preferredLanguage === lang
        ? (newLangs[0] || "")
        : prev.preferredLanguage;
      return { ...prev, languagesKnown: newLangs, preferredLanguage: newPref };
    });
  };

  const sidebarLinks = links.map((l) => ({ ...l }));

  const adminName = user?.name || "Admin";
  const adminAvatar = adminName.charAt(0).toUpperCase();

  return (
    <>
    <DashboardLayout title={tab === "overview" ? "Admin Overview" : tab.charAt(0).toUpperCase() + tab.slice(1)} links={sidebarLinks} userName={adminName} userAvatar={adminAvatar}>

      {tab === "overview" && (
        <div className="space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
          {!loading && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={UserCheck} label="Total Doctors" value={doctors.length} tint="primary" />
                <StatCard icon={Users} label="Total Patients" value={patients.length} tint="accent" />
                <StatCard icon={Pill} label="Total Pharmacists" value={pharmacists.length} tint="primary" />
                <StatCard icon={CalendarDays} label="Active Sessions" value={sessions.filter((s) => s.status === "ongoing").length} tint="success" />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-lg p-6 shadow-card">
                  <SectionHeader title="Recent Signups" />
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="pb-2">Name</th><th className="pb-2">Role</th><th className="pb-2">Date</th><th className="pb-2">Status</th></tr></thead>
                    <tbody>
                      {[...doctors.slice(0, 2).map((d) => ({ name: d.name, role: "Doctor", date: "Recent", status: "active" })),
                        ...patients.slice(0, 2).map((p) => ({ name: p.name, role: "Patient", date: "Recent", status: "active" as const }))
                      ].map((r, i) => (
                        <tr key={i} className="border-b border-border last:border-0 zebra-row"><td className="py-2.5 text-foreground">{r.name}</td><td className="py-2.5 text-muted-foreground">{r.role}</td><td className="py-2.5 text-muted-foreground">{r.date}</td><td className="py-2.5"><StatusBadge status={r.status as any} /></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-card border border-border rounded-lg p-6 shadow-card">
                  <SectionHeader title="Platform Activity" />
                  <div className="space-y-4">
                    {[
                        { label: "Sessions this week", value: sessions.length },
                        { label: "Registered Doctors", value: doctors.length },
                        { label: "Registered Patients", value: patients.length },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                        <span className="text-lg font-heading font-bold text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "doctors" && (
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <SectionHeader title="Doctors" action={
            <div className="flex gap-3">
              <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={doctorSearch} onChange={(e) => setDoctorSearch(e.target.value)} placeholder="Search doctors…" className="pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" /></div>
              <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-md" onClick={() => { setShowDoctorModal(true); setDoctorError(""); setDoctorSuccess(""); }}><Plus className="w-4 h-4" /> Add Doctor</button>
            </div>
          } />
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="pb-2">ID</th><th className="pb-2">Name</th><th className="pb-2">Specialization</th><th className="pb-2">Languages</th><th className="pb-2">Email</th><th className="pb-2">Actions</th></tr></thead>
              <tbody>
                {doctors.filter((d) => !doctorSearch.trim() || d.name?.toLowerCase().includes(doctorSearch.toLowerCase()) || d.email?.toLowerCase().includes(doctorSearch.toLowerCase()) || (d.specialization || "").toLowerCase().includes(doctorSearch.toLowerCase()) || (d.doctorId || "").toLowerCase().includes(doctorSearch.toLowerCase())).map((d) => (
                  <tr key={d._id} className="border-b border-border last:border-0 zebra-row">
                    <td className="py-2.5 font-mono text-xs text-muted-foreground">{d.doctorId || d.id}</td>
                    <td className="py-2.5 text-foreground font-medium">{d.name}</td>
                    <td className="py-2.5 text-muted-foreground">{d.specialization}</td>
                    <td className="py-2.5 text-muted-foreground">{(d.languagesKnown || d.languages || []).join(", ")}</td>
                    <td className="py-2.5 text-muted-foreground">{d.email}</td>
                    <td className="py-2.5 flex gap-2">
                      <button className="text-destructive hover:text-destructive/80" onClick={() => handleDeleteDoctor(d._id, d.name)}><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "patients" && (
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <SectionHeader title="Patients" action={
            <div className="flex gap-3">
              <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="Search patients…" className="pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" /></div>
              <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-md" onClick={() => { setShowPatientModal(true); setPatientError(""); setPatientSuccess(""); }}><Plus className="w-4 h-4" /> Add Patient</button>
            </div>
          } />
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="pb-2">ID</th><th className="pb-2">Name</th><th className="pb-2">Email</th><th className="pb-2">Blood Group</th><th className="pb-2">Phone</th><th className="pb-2">Actions</th></tr></thead>
              <tbody>
                {patients.filter((p) => !patientSearch.trim() || p.name?.toLowerCase().includes(patientSearch.toLowerCase()) || p.email?.toLowerCase().includes(patientSearch.toLowerCase()) || (p.patientId || "").toLowerCase().includes(patientSearch.toLowerCase())).map((p) => (
                  <tr key={p._id} className="border-b border-border last:border-0 zebra-row">
                    <td className="py-2.5 font-mono text-xs text-muted-foreground">{p.patientId || p.id}</td>
                    <td className="py-2.5 text-foreground font-medium">{p.name}</td>
                    <td className="py-2.5 text-muted-foreground">{p.email}</td>
                    <td className="py-2.5 text-muted-foreground">{p.bloodGroup}</td>
                    <td className="py-2.5 text-muted-foreground">{p.phoneNumber || p.phone}</td>
                    <td className="py-2.5 flex gap-2">
                      <button className="text-destructive hover:text-destructive/80" onClick={() => handleDeletePatient(p._id, p.name)}><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "pharmacists" && (
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <SectionHeader title="Pharmacists" action={
            <div className="flex gap-3">
              <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={pharmacistSearch} onChange={(e) => setPharmacistSearch(e.target.value)} placeholder="Search pharmacists…" className="pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" /></div>
              <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-md" onClick={() => { setShowPharmacistModal(true); setPharmacistError(""); setPharmacistSuccess(""); }}><Plus className="w-4 h-4" /> Add Pharmacist</button>
            </div>
          } />
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="pb-2">ID</th><th className="pb-2">Name</th><th className="pb-2">Designation</th><th className="pb-2">Email</th><th className="pb-2">Phone</th><th className="pb-2">Actions</th></tr></thead>
              <tbody>
                {pharmacists.filter((p) => !pharmacistSearch.trim() || p.name?.toLowerCase().includes(pharmacistSearch.toLowerCase()) || p.email?.toLowerCase().includes(pharmacistSearch.toLowerCase()) || (p.designation || "").toLowerCase().includes(pharmacistSearch.toLowerCase()) || (p.pharmacistId || "").toLowerCase().includes(pharmacistSearch.toLowerCase())).map((p) => (
                  <tr key={p._id} className="border-b border-border last:border-0 zebra-row">
                    <td className="py-2.5 font-mono text-xs text-muted-foreground">{p.pharmacistId || p.id}</td>
                    <td className="py-2.5 text-foreground font-medium">{p.name}</td>
                    <td className="py-2.5 text-muted-foreground">{p.designation}</td>
                    <td className="py-2.5 text-muted-foreground">{p.email}</td>
                    <td className="py-2.5 text-muted-foreground">{p.phoneNumber || p.phone}</td>
                    <td className="py-2.5 flex gap-2">
                      <button className="text-destructive hover:text-destructive/80" onClick={() => handleDeletePharmacist(p._id, p.name)}><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "sessions" && (
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <SectionHeader title="Sessions" />
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState icon={Inbox} message="No sessions found." />
          ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="pb-2">ID</th><th className="pb-2">Doctor</th><th className="pb-2">Patient</th><th className="pb-2">Start</th><th className="pb-2">End</th><th className="pb-2">Status</th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s._id} className="border-b border-border last:border-0 zebra-row">
                  <td className="py-2.5 font-mono text-xs text-muted-foreground">{s.sessionId}</td>
                  <td className="py-2.5 text-foreground">{s.doctorId?.name || "—"}</td>
                  <td className="py-2.5 text-foreground">{s.patientId?.name || "—"}</td>
                  <td className="py-2.5 text-muted-foreground">{s.startTimestamp ? new Date(s.startTimestamp).toLocaleString() : "—"}</td>
                  <td className="py-2.5 text-muted-foreground">{s.endTimestamp ? new Date(s.endTimestamp).toLocaleString() : "—"}</td>
                  <td className="py-2.5"><StatusBadge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div className="space-y-6 max-w-2xl">
          {/* Profile overview (read-only) */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-card">
            <SectionHeader title="Profile" />
            <div className="space-y-2 text-sm">
              {([
                ["Name", user?.name],
                ["Email", user?.email],
                ["Role", "Administrator"],
              ] as [string, string | undefined][]).map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-foreground font-medium">{value || "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Platform overview */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-card">
            <SectionHeader title="Platform Summary" />
            <div className="space-y-2 text-sm">
              {([
                ["Total Doctors", String(doctors.length)],
                ["Total Patients", String(patients.length)],
                ["Total Pharmacists", String(pharmacists.length)],
                ["Total Sessions", String(sessions.length)],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-foreground font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>

    {/* ── Add Doctor Modal ── */}
    {showDoctorModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-base font-heading font-bold text-foreground">Add Doctor</h2>
            <button onClick={() => setShowDoctorModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleAddDoctor} className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Full Name *</label>
                <input required value={doctorForm.name} onChange={(e) => setDoctorForm((p) => ({ ...p, name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Email *</label>
                <input required type="email" value={doctorForm.email} onChange={(e) => setDoctorForm((p) => ({ ...p, email: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Date of Birth *</label>
                <input required type="date" max={new Date().toISOString().split("T")[0]} value={doctorForm.dob} onChange={(e) => setDoctorForm((p) => ({ ...p, dob: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Specialization *</label>
                <select required value={doctorForm.specialization} onChange={(e) => setDoctorForm((p) => ({ ...p, specialization: e.target.value }))} className={inputCls}>
                  <option value="" disabled>Select specialization</option>
                  {specializationOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Phone Number</label>
              <input value={doctorForm.phoneNumber} onChange={(e) => setDoctorForm((p) => ({ ...p, phoneNumber: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Languages Known</label>
              <div className="flex flex-wrap gap-2">
                {languageOptions.map((lang) => (
                  <button key={lang} type="button" onClick={() => toggleDoctorLang(lang)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                      doctorForm.languagesKnown.includes(lang) ? "gradient-primary text-primary-foreground border-transparent" : "bg-background text-muted-foreground border-border"
                    }`}>{lang}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Preferred Language <span className="text-muted-foreground font-normal">(for email notifications)</span></label>
              <select
                required
                value={doctorForm.preferredLanguage}
                onChange={(e) => setDoctorForm((p) => ({ ...p, preferredLanguage: e.target.value }))}
                className={inputCls}
              >
                {doctorForm.languagesKnown.length === 0 && (
                  <option value="" disabled>Select at least one language above</option>
                )}
                {doctorForm.languagesKnown.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            {doctorError && <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{doctorError}</p>}
            {doctorSuccess && <p className="text-xs text-green-600 bg-green-50 rounded px-3 py-2">{doctorSuccess}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowDoctorModal(false)} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-md">Cancel</button>
              <button type="submit" disabled={doctorLoading} className="px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-md disabled:opacity-50">
                {doctorLoading ? "Creating..." : "Create Doctor"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* ── Add Pharmacist Modal ── */}
    {showPharmacistModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-base font-heading font-bold text-foreground">Add Pharmacist</h2>
            <button onClick={() => setShowPharmacistModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleAddPharmacist} className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Full Name *</label>
                <input required value={pharmacistForm.name} onChange={(e) => setPharmacistForm((p) => ({ ...p, name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Email *</label>
                <input required type="email" value={pharmacistForm.email} onChange={(e) => setPharmacistForm((p) => ({ ...p, email: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Phone Number *</label>
                <input required value={pharmacistForm.phoneNumber} onChange={(e) => setPharmacistForm((p) => ({ ...p, phoneNumber: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Designation *</label>
                <select required value={pharmacistForm.designation} onChange={(e) => setPharmacistForm((p) => ({ ...p, designation: e.target.value }))} className={inputCls}>
                  <option value="" disabled>Select designation</option>
                  {designationOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Languages Known</label>
              <div className="flex flex-wrap gap-2">
                {languageOptions.map((lang) => (
                  <button key={lang} type="button" onClick={() => togglePharmacistLang(lang)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                      pharmacistForm.languagesKnown.includes(lang) ? "gradient-primary text-primary-foreground border-transparent" : "bg-background text-muted-foreground border-border"
                    }`}>{lang}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Preferred Language <span className="text-muted-foreground font-normal">(for email notifications)</span></label>
              <select
                required
                value={pharmacistForm.preferredLanguage}
                onChange={(e) => setPharmacistForm((p) => ({ ...p, preferredLanguage: e.target.value }))}
                className={inputCls}
              >
                {pharmacistForm.languagesKnown.length === 0 && (
                  <option value="" disabled>Select at least one language above</option>
                )}
                {pharmacistForm.languagesKnown.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            {pharmacistError && <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{pharmacistError}</p>}
            {pharmacistSuccess && <p className="text-xs text-green-600 bg-green-50 rounded px-3 py-2">{pharmacistSuccess}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowPharmacistModal(false)} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-md">Cancel</button>
              <button type="submit" disabled={pharmacistLoading} className="px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-md disabled:opacity-50">
                {pharmacistLoading ? "Creating..." : "Create Pharmacist"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* ── Add Patient Modal ── */}
    {showPatientModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-base font-heading font-bold text-foreground">Add Patient</h2>
            <button onClick={() => setShowPatientModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleAddPatient} className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Full Name *</label>
                <input required value={patientForm.name} onChange={(e) => setPatientForm((p) => ({ ...p, name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Email *</label>
                <input required type="email" value={patientForm.email} onChange={(e) => setPatientForm((p) => ({ ...p, email: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Date of Birth *</label>
              <input required type="date" max={new Date().toISOString().split("T")[0]} value={patientForm.dob} onChange={(e) => setPatientForm((p) => ({ ...p, dob: e.target.value }))} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Gender *</label>
                <select required value={patientForm.gender} onChange={(e) => setPatientForm((p) => ({ ...p, gender: e.target.value as any }))} className={inputCls}>
                  <option value="" disabled>Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Blood Group *</label>
                <select required value={patientForm.bloodGroup} onChange={(e) => setPatientForm((p) => ({ ...p, bloodGroup: e.target.value as any }))} className={inputCls}>
                  <option value="" disabled>Select blood group</option>
                  {bloodGroupOptions.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Phone Number *</label>
              <input required value={patientForm.phoneNumber} onChange={(e) => setPatientForm((p) => ({ ...p, phoneNumber: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Languages Known</label>
              <div className="flex flex-wrap gap-2">
                {languageOptions.map((lang) => (
                  <button key={lang} type="button" onClick={() => togglePatientLang(lang)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                      patientForm.languagesKnown.includes(lang) ? "gradient-primary text-primary-foreground border-transparent" : "bg-background text-muted-foreground border-border"
                    }`}>{lang}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Preferred Language <span className="text-muted-foreground font-normal">(for email notifications)</span></label>
              <select
                required
                value={patientForm.preferredLanguage}
                onChange={(e) => setPatientForm((p) => ({ ...p, preferredLanguage: e.target.value }))}
                className={inputCls}
              >
                {patientForm.languagesKnown.length === 0 && (
                  <option value="" disabled>Select at least one language above</option>
                )}
                {patientForm.languagesKnown.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            {patientError && <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{patientError}</p>}
            {patientSuccess && <p className="text-xs text-green-600 bg-green-50 rounded px-3 py-2">{patientSuccess}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowPatientModal(false)} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-md">Cancel</button>
              <button type="submit" disabled={patientLoading} className="px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-md disabled:opacity-50">
                {patientLoading ? "Creating..." : "Create Patient"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* ─── Delete Confirmation Modal ─── */}
    {deleteConfirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-base font-heading font-bold text-foreground">
              Delete {deleteConfirm.type.charAt(0).toUpperCase() + deleteConfirm.type.slice(1)}
            </h2>
            <button onClick={() => { setDeleteConfirm(null); setDeleteError(""); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-foreground">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
            </p>
            <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
            {deleteError && (
              <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{deleteError}</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setDeleteConfirm(null); setDeleteError(""); }}
                className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-md hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-destructive hover:bg-destructive/90 rounded-md disabled:opacity-50 flex items-center gap-2"
              >
                {deleteLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default AdminDashboard;
