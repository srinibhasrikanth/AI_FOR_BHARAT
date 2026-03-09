import { useState, useEffect, useRef, useCallback, useMemo, Component, type ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard, StatusBadge, SectionHeader, EmptyState } from "@/components/ui/custom-ui";
import {
  LayoutDashboard, ClipboardList, Package, FileText, Settings,
  Search, Plus, Edit, Trash2, CheckCircle, AlertTriangle, Inbox, RefreshCw,
  Bell, X, ChevronLeft, ChevronRight, TrendingDown, ShieldAlert, BadgeCheck,
  Ban, Pill, QrCode, ScanLine,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { pharmacistApi } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────────
interface Medicine {
  _id: string; medicineId: string; name: string; category: string;
  manufacturer: string | null; batchNumber: string | null; expiryDate: string | null;
  dosage: string; unit: string; description: string | null;
  cost: number; quantity: number; reorderLevel: number;
  lastEditedBy: { name: string } | null; lastEdited: string;
}
interface PrescrMed {
  medicineId: Medicine | null; name: string; dosage: string;
  durationDays: number; time: string[];
}
interface Prescription {
  _id: string; prescriptionId: string;
  patientId: { name: string; patientId: string } | null;
  doctorId: { name: string; specialization: string } | null;
  medicines: PrescrMed[];
  status: "pending" | "dispensed" | "partially_dispensed" | "cancelled";
  stockAlerts: { name: string; required: number; available: number }[];
  dispensedBy: { name: string } | null; dispensedAt: string | null;
  dispensingNotes: string | null; createdAt: string;
}
interface InventoryTransaction {
  _id: string; transactionId: string; medicineName: string;
  type: "initial" | "restock" | "dispensed" | "adjustment" | "deleted";
  quantityChange: number; quantityBefore: number; quantityAfter: number;
  performedByName: string | null; performedByRole: string;
  patientName: string | null; notes: string | null; createdAt: string;
}

const calcRequiredQty = (med: PrescrMed) => {
  const days = med.durationDays || 1;
  const daily = (med.time || []).filter(t => t !== "sos");
  if (daily.length === 0 && med.time?.includes("sos")) return 1;
  return days * Math.max(daily.length, 1);
};

const MEDICINE_CATEGORIES = ["Tablet","Capsule","Syrup","Injection","Cream/Ointment","Drops","Inhaler","Patch","Suppository","Powder","Solution","Other"];
const emptyMedForm = { name:"", category:"Tablet", manufacturer:"", batchNumber:"", expiryDate:"", dosage:"", unit:"units", description:"", cost:"", quantity:"", reorderLevel:"20" };
const inputCls = "w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

// ─── Modal wrapper ───────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children, width = "max-w-lg" }: { title: string; onClose: () => void; children: React.ReactNode; width?: string }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className={`bg-background border border-border rounded-xl shadow-xl w-full ${width} max-h-[90vh] overflow-y-auto`}>
      <div className="flex items-center justify-between p-5 border-b border-border">
        <h2 className="text-base font-heading font-bold text-foreground">{title}</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

// ─── Tab Error Boundary ──────────────────────────────────────────────────────────
class TabErrorBoundary extends Component<
  { children: ReactNode; tab: string },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode; tab: string }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || "Unknown error" };
  }
  componentDidCatch(error: Error) {
    console.error(`[PharmacistDashboard tab="${this.props.tab}"] render error:`, error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <AlertTriangle className="w-10 h-10 text-destructive" />
          <p className="text-sm font-medium text-foreground">Something went wrong rendering this tab.</p>
          <p className="text-xs text-muted-foreground max-w-sm">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            className="mt-2 px-4 py-2 text-xs font-medium text-primary-foreground gradient-primary rounded-lg"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────────
// (links defined inside component for i18n)

const PharmacistDashboard = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "overview";
  const { user, accessToken } = useAuth();

  const links = useMemo(() => [
    { label: "Overview",      to: "/dashboard/pharmacist",                   icon: LayoutDashboard },
    { label: "Prescriptions", to: "/dashboard/pharmacist?tab=prescriptions", icon: ClipboardList },
    { label: "Scan QR",       to: "/dashboard/pharmacist?tab=scanqr",        icon: QrCode },
    { label: "Inventory",     to: "/dashboard/pharmacist?tab=inventory",     icon: Package },
    { label: "Alerts",        to: "/dashboard/pharmacist?tab=alerts",        icon: Bell },
    { label: "Tx Log",        to: "/dashboard/pharmacist?tab=log",           icon: FileText },
    { label: "Settings",      to: "/dashboard/pharmacist?tab=settings",      icon: Settings },
  ], []);

  // ── Data ───────────────────────────────────────────────────────────────────────
  const [pharmacist,    setPharmacist]    = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medicines,     setMedicines]     = useState<Medicine[]>([]);
  const [lowStock,      setLowStock]      = useState<Medicine[]>([]);
  const [stats,         setStats]         = useState<any>(null);
  const [txData,        setTxData]        = useState<{ transactions: InventoryTransaction[]; total: number; page: number; totalPages: number } | null>(null);
  const [loading,       setLoading]       = useState(true);

  // ── Filters ────────────────────────────────────────────────────────────────────
  const [rxStatusFilter,    setRxStatusFilter]    = useState("all");
  const [rxSearch,          setRxSearch]          = useState("");
  const [medSearch,         setMedSearch]         = useState("");
  const [medCategoryFilter, setMedCategoryFilter] = useState("all");
  const [showLowStockOnly,  setShowLowStockOnly]  = useState(false);
  const [logTypeFilter,     setLogTypeFilter]     = useState("all");
  const [logPage,           setLogPage]           = useState(1);

  // ── Medicine modal ─────────────────────────────────────────────────────────────
  const [showMedModal, setShowMedModal] = useState(false);
  const [editingMed,   setEditingMed]   = useState<Medicine | null>(null);
  const [medForm,      setMedForm]      = useState({ ...emptyMedForm });
  const [medLoading,   setMedLoading]   = useState(false);
  const [medError,     setMedError]     = useState("");
  const [medSuccess,   setMedSuccess]   = useState("");

  // ── Restock modal ──────────────────────────────────────────────────────────────
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockMed,       setRestockMed]       = useState<Medicine | null>(null);
  const [restockQty,       setRestockQty]       = useState("");
  const [restockNotes,     setRestockNotes]     = useState("");
  const [restockLoading,   setRestockLoading]   = useState(false);
  const [restockError,     setRestockError]     = useState("");

  // ── Delete ─────────────────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Medicine | null>(null);
  const [deleteLoading,     setDeleteLoading]     = useState(false);
  const [deleteError,       setDeleteError]       = useState("");

  // ── Dispense modal ─────────────────────────────────────────────────────────────
  const [showDispenseModal, setShowDispenseModal] = useState<Prescription | null>(null);
  const [dispenseNotes,     setDispenseNotes]     = useState("");
  const [dispenseLoading,   setDispenseLoading]   = useState(false);
  const [dispenseError,     setDispenseError]     = useState("");

  // ── Flag modal ─────────────────────────────────────────────────────────────────
  const [showFlagModal, setShowFlagModal] = useState<Prescription | null>(null);
  const [flagNotes,     setFlagNotes]     = useState("");
  const [flagLoading,   setFlagLoading]   = useState(false);
  const [flagError,     setFlagError]     = useState("");

  // ── Profile ────────────────────────────────────────────────────────────────────
  const [profileForm,    setProfileForm]    = useState({ name:"", phoneNumber:"", designation:"" });
  const [profileLoading, setProfileLoading] = useState(false);

  // ── QR scan ────────────────────────────────────────────────────────────────────
  const qrScannerRef         = useRef<any>(null);
  const qrDivRef             = useRef<HTMLDivElement>(null);
  const [qrInput,           setQrInput]           = useState("");
  const [qrLoading,         setQrLoading]         = useState(false);
  const [scannedOrder,      setScannedOrder]      = useState<any>(null);
  const [qrError,           setQrError]           = useState("");
  const [dispenseQrNotes,   setDispenseQrNotes]   = useState("");
  const [dispenseQrLoading, setDispenseQrLoading] = useState(false);
  const [dispenseQrSuccess, setDispenseQrSuccess] = useState("");
  const [scannerActive,     setScannerActive]     = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [profRes, rxRes, medsRes, lowRes, statsRes] = await Promise.allSettled([
        pharmacistApi.getProfile(accessToken),
        pharmacistApi.getPrescriptions(accessToken),
        pharmacistApi.getMedicines(accessToken),
        pharmacistApi.getLowStockMedicines(accessToken),
        pharmacistApi.getInventoryStats(accessToken),
      ]);
      if (profRes.status  === "fulfilled") { setPharmacist(profRes.value.data); setProfileForm({ name: profRes.value.data?.name || "", phoneNumber: profRes.value.data?.phoneNumber || "", designation: profRes.value.data?.designation || "" }); }
      if (rxRes.status    === "fulfilled") setPrescriptions(rxRes.value.data || []);
      if (medsRes.status  === "fulfilled") setMedicines(medsRes.value.data || []);
      if (lowRes.status   === "fulfilled") setLowStock(lowRes.value.data || []);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
    } catch (e) { console.error(e); }
  }, [accessToken]);

  const fetchLogs = useCallback(async (page = 1, type = "all") => {
    if (!accessToken) return;
    try {
      const res = await pharmacistApi.getInventoryLogs(accessToken, { page, limit: 20, ...(type !== "all" && { type }) });
      setTxData(res.data);
    } catch (e) { console.error(e); }
  }, [accessToken]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  useEffect(() => {
    if (tab === "log") fetchLogs(logPage, logTypeFilter);
  }, [tab, logPage, logTypeFilter, fetchLogs]);

  useEffect(() => {
    if (tab !== "scanqr") {
      qrScannerRef.current?.stop().catch(() => {});
      qrScannerRef.current = null;
      setScannerActive(false);
    }
  }, [tab]);

  // ── Derived ────────────────────────────────────────────────────────────────────
  const filteredRx = useMemo(() => prescriptions.filter(p => {
    if (rxStatusFilter !== "all" && p.status !== rxStatusFilter) return false;
    if (rxSearch.trim()) {
      const q = rxSearch.toLowerCase();
      return p.prescriptionId?.toLowerCase().includes(q) || p.patientId?.name?.toLowerCase().includes(q) || p.doctorId?.name?.toLowerCase().includes(q);
    }
    return true;
  }), [prescriptions, rxStatusFilter, rxSearch]);

  const filteredMeds = useMemo(() => medicines.filter(m => {
    if (showLowStockOnly && m.quantity > m.reorderLevel) return false;
    if (medCategoryFilter !== "all" && m.category !== medCategoryFilter) return false;
    if (medSearch.trim()) { const q = medSearch.toLowerCase(); return m.name?.toLowerCase().includes(q) || m.medicineId?.toLowerCase().includes(q); }
    return true;
  }), [medicines, medSearch, medCategoryFilter, showLowStockOnly]);

  const pharmacistName = pharmacist?.name || user?.name || "Pharmacist";

  // ── Handlers ───────────────────────────────────────────────────────────────────
  const openAddMed  = () => { setEditingMed(null); setMedForm({ ...emptyMedForm }); setMedError(""); setMedSuccess(""); setShowMedModal(true); };
  const openEditMed = (m: Medicine) => {
    setEditingMed(m);
    setMedForm({ name:m.name, category:m.category, manufacturer:m.manufacturer||"", batchNumber:m.batchNumber||"", expiryDate:m.expiryDate ? m.expiryDate.split("T")[0] : "", dosage:m.dosage, unit:m.unit, description:m.description||"", cost:String(m.cost), quantity:String(m.quantity), reorderLevel:String(m.reorderLevel) });
    setMedError(""); setMedSuccess(""); setShowMedModal(true);
  };

  const handleSaveMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setMedLoading(true); setMedError(""); setMedSuccess("");
    try {
      const payload = { ...medForm, cost: Number(medForm.cost), quantity: Number(medForm.quantity), reorderLevel: Number(medForm.reorderLevel) };
      if (editingMed) { await pharmacistApi.updateMedicine(accessToken, editingMed._id, payload); setMedSuccess("Medicine updated."); }
      else            { await pharmacistApi.addMedicine(accessToken, payload); setMedSuccess("Medicine added to inventory."); }
      await fetchAll();
      setTimeout(() => setShowMedModal(false), 800);
    } catch (e: any) { setMedError(e.message || "Failed to save medicine."); }
    finally { setMedLoading(false); }
  };

  const handleDeleteMed = async () => {
    if (!accessToken || !showDeleteConfirm) return;
    setDeleteLoading(true); setDeleteError("");
    try { await pharmacistApi.deleteMedicine(accessToken, showDeleteConfirm._id); await fetchAll(); setShowDeleteConfirm(null); }
    catch (e: any) { setDeleteError(e.message || "Failed to delete."); }
    finally { setDeleteLoading(false); }
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !restockMed) return;
    setRestockLoading(true); setRestockError("");
    try { await pharmacistApi.restockMedicine(accessToken, restockMed._id, Number(restockQty), restockNotes || undefined); await fetchAll(); setShowRestockModal(false); setRestockQty(""); setRestockNotes(""); }
    catch (e: any) { setRestockError(e.message || "Failed to restock."); }
    finally { setRestockLoading(false); }
  };

  const handleDispense = async () => {
    if (!accessToken || !showDispenseModal) return;
    setDispenseLoading(true); setDispenseError("");
    try { await pharmacistApi.dispensePrescription(accessToken, showDispenseModal._id, dispenseNotes || undefined); await fetchAll(); setShowDispenseModal(null); setDispenseNotes(""); }
    catch (e: any) { setDispenseError(e.message || "Failed to dispense."); }
    finally { setDispenseLoading(false); }
  };

  const handleFlag = async () => {
    if (!accessToken || !showFlagModal || !flagNotes.trim()) return;
    setFlagLoading(true); setFlagError("");
    try { await pharmacistApi.flagPrescription(accessToken, showFlagModal._id, flagNotes); await fetchAll(); setShowFlagModal(null); setFlagNotes(""); }
    catch (e: any) { setFlagError(e.message || "Failed to flag."); }
    finally { setFlagLoading(false); }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setProfileLoading(true);
    try { await pharmacistApi.updateProfile(accessToken, profileForm); await fetchAll(); }
    catch (e) { console.error(e); }
    finally { setProfileLoading(false); }
  };

  const handleScanQr = useCallback(async (token: string) => {
    if (!accessToken || !token.trim()) return;
    setQrLoading(true); setQrError(""); setScannedOrder(null); setDispenseQrSuccess(""); setDispenseQrNotes("");
    try { const res = await pharmacistApi.scanQrToken(accessToken, token.trim()); setScannedOrder(res.data); }
    catch (e: any) { setQrError(e.message || "Invalid QR token."); }
    finally { setQrLoading(false); }
  }, [accessToken]);

  const handleDispenseQr = useCallback(async () => {
    if (!accessToken || !scannedOrder) return;
    setDispenseQrLoading(true); setQrError("");
    try { await pharmacistApi.dispenseOrder(accessToken, scannedOrder._id, dispenseQrNotes); setDispenseQrSuccess(`✓ Order ${scannedOrder.orderId} dispensed.`); setScannedOrder(null); setQrInput(""); setDispenseQrNotes(""); }
    catch (e: any) { setQrError(e.message || "Failed to dispense."); }
    finally { setDispenseQrLoading(false); }
  }, [accessToken, scannedOrder, dispenseQrNotes]);

  const stopWebcamScanner = useCallback(() => {
    qrScannerRef.current?.stop().catch(() => {});
    qrScannerRef.current = null;
    setScannerActive(false);
  }, []);

  const startWebcamScanner = useCallback(async () => {
    if (!qrDivRef.current) return;
    setScannerActive(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader-div");
      qrScannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text: string) => { scanner.stop().catch(() => {}); setScannerActive(false); setQrInput(text); handleScanQr(text); },
        () => {}
      );
    } catch { setScannerActive(false); setQrError("Could not access camera. Use manual entry below."); }
  }, [handleScanQr]);

  if (loading) return (
    <DashboardLayout title="Pharmacy Overview" links={links} userName={pharmacistName} userAvatar={pharmacistName.charAt(0)}>
      <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div>
    </DashboardLayout>
  );

  return (
    <>
    <DashboardLayout
      title={tab === "overview" ? "Pharmacy Overview" : tab === "prescriptions" ? "Prescriptions" : tab === "inventory" ? "Medicine Inventory" : tab === "scanqr" ? "Scan QR" : tab === "alerts" ? "Stock Alerts" : tab === "log" ? "Transaction Log" : "Settings"}
      links={links} userName={pharmacistName} userAvatar={pharmacistName.charAt(0)}>
      <TabErrorBoundary tab={tab}>

      {/* ════ OVERVIEW ════ */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={ClipboardList} label="Pending Prescriptions" value={prescriptions.filter(p => p.status === "pending").length} tint="primary" />
            <StatCard icon={CheckCircle}   label="Dispensed"             value={prescriptions.filter(p => p.status === "dispensed").length} tint="success" />
            <StatCard icon={AlertTriangle} label="Low Stock"             value={lowStock.length} tint="destructive" />
            <StatCard icon={Package}       label="Total Medicines"       value={medicines.length} tint="accent" />
          </div>

          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-xl p-4 shadow-card">
                <p className="text-xs text-muted-foreground mb-1">Total Stock Value</p>
                <p className="text-2xl font-bold text-foreground">₹{(stats.totalStockValue || 0).toLocaleString()}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-card">
                <p className="text-xs text-muted-foreground mb-1">Categories</p>
                <p className="text-2xl font-bold text-foreground">{stats.categoryBreakdown?.length || 0}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-card">
                <p className="text-xs text-muted-foreground mb-1">Out of Stock</p>
                <p className="text-2xl font-bold text-destructive">{stats.outOfStockCount || 0}</p>
              </div>
            </div>
          )}

          {prescriptions.filter(p => p.status === "pending").length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-card">
              <SectionHeader title="Pending Prescriptions" />
              <div className="space-y-3 mt-3">
                {prescriptions.filter(p => p.status === "pending").slice(0, 3).map(p => (
                  <div key={p._id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.patientId?.name || "Patient"}</p>
                      <p className="text-xs text-muted-foreground">by {p.doctorId?.name || "Doctor"} · {p.medicines?.length || 0} medicines</p>
                    </div>
                    <button onClick={() => { setShowDispenseModal(p); setDispenseNotes(""); setDispenseError(""); }}
                      className="px-3 py-1.5 text-xs font-medium text-primary-foreground gradient-primary rounded-md">
                      Dispense
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lowStock.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-card">
              <SectionHeader title="Low Stock Medicines" />
              <div className="space-y-2 mt-3">
                {lowStock.slice(0, 5).map(m => (
                  <div key={m._id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.category} · {m.dosage}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${m.quantity === 0 ? "text-destructive" : "text-warning"}`}>{m.quantity} {m.unit}</p>
                      <button onClick={() => { setRestockMed(m); setRestockQty(""); setRestockNotes(""); setRestockError(""); setShowRestockModal(true); }}
                        className="text-xs text-primary underline">Restock</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ PRESCRIPTIONS ════ */}
      {tab === "prescriptions" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={rxSearch} onChange={e => setRxSearch(e.target.value)} placeholder="Search patient / prescription…" className="w-full pl-9 pr-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            {(["all","pending","dispensed","partially_dispensed","cancelled"] as const).map(s => (
              <button key={s} onClick={() => setRxStatusFilter(s)}
                className={`px-3 py-1.5 text-xs rounded-full font-medium border transition-colors ${rxStatusFilter === s ? "gradient-primary text-primary-foreground border-transparent" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {s === "all" ? "All" : s === "partially_dispensed" ? "Partial" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {filteredRx.length === 0
            ? <EmptyState icon={Inbox} message="No prescriptions match the filter." />
            : filteredRx.map(p => (
              <div key={p._id} className="bg-card border border-border rounded-xl p-5 shadow-card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{p.prescriptionId}</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{p.patientId?.name || "—"}</p>
                    <p className="text-xs text-muted-foreground">Dr. {p.doctorId?.name || "—"} · {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                {p.medicines?.length > 0 && (
                  <table className="w-full text-xs mb-3">
                    <thead><tr className="border-b border-border text-muted-foreground"><th className="pb-1.5 text-left font-medium">Medicine</th><th className="pb-1.5 text-left font-medium">Dosage</th><th className="pb-1.5 text-left font-medium">Duration</th><th className="pb-1.5 text-center font-medium">Qty needed</th></tr></thead>
                    <tbody>
                      {p.medicines.map((m, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="py-1.5 text-foreground font-medium">{m.name || m.medicineId?.name || "—"}</td>
                          <td className="py-1.5 text-muted-foreground">{m.dosage || "—"}</td>
                          <td className="py-1.5 text-muted-foreground">{m.durationDays ? `${m.durationDays}d` : "—"}</td>
                          <td className="py-1.5 text-center font-bold text-foreground">{calcRequiredQty(m)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {p.stockAlerts?.length > 0 && (
                  <div className="mb-3 bg-warning/10 border border-warning/30 rounded-lg p-2.5 text-xs text-warning-foreground">
                    ⚠ {p.stockAlerts.map(a => `${a.name} (need ${a.required}, have ${a.available})`).join(" · ")}
                  </div>
                )}

                {p.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => { setShowDispenseModal(p); setDispenseNotes(""); setDispenseError(""); }}
                      className="px-4 py-2 text-xs font-semibold text-primary-foreground gradient-primary rounded-lg flex items-center gap-1.5">
                      <BadgeCheck className="w-3.5 h-3.5" /> Dispense
                    </button>
                    <button onClick={() => { setShowFlagModal(p); setFlagNotes(""); setFlagError(""); }}
                      className="px-4 py-2 text-xs font-semibold text-destructive border border-destructive/40 rounded-lg flex items-center gap-1.5 hover:bg-destructive/5">
                      <Ban className="w-3.5 h-3.5" /> Flag Issue
                    </button>
                  </div>
                )}
                {p.dispensedAt && (
                  <p className="text-xs text-muted-foreground mt-2">Dispensed by {p.dispensedBy?.name || "—"} on {new Date(p.dispensedAt).toLocaleDateString()}</p>
                )}
              </div>
            ))
          }
        </div>
      )}

      {/* ════ SCAN QR ════ */}
      {tab === "scanqr" && (
        <div className="space-y-6 max-w-2xl mx-auto">
          <div className="bg-card border border-border rounded-xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
                <QrCode className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-base font-heading font-bold text-foreground">Scan Patient QR</h2>
                <p className="text-xs text-muted-foreground">Scan the QR from the patient's app to validate and dispense.</p>
              </div>
            </div>

            {dispenseQrSuccess && <div className="mb-4 bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 text-sm text-primary font-medium flex items-center gap-2"><CheckCircle className="w-4 h-4" />{dispenseQrSuccess}</div>}
            {qrError          && <div className="mb-4 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 text-sm text-destructive">{qrError}</div>}

            <div id="qr-reader-div" ref={qrDivRef} className={`w-full rounded-xl overflow-hidden border border-border bg-black mb-4 ${scannerActive ? "min-h-[300px]" : "hidden"}`} />

            <div className="flex gap-3 mb-5">
              {!scannerActive
                ? <button onClick={startWebcamScanner} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-foreground gradient-primary rounded-lg"><ScanLine className="w-4 h-4" /> Use Camera</button>
                : <button onClick={stopWebcamScanner}  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-border rounded-lg hover:bg-muted"><X className="w-4 h-4" /> Stop Camera</button>
              }
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Manual Entry</label>
              <div className="flex gap-2">
                <input className={`${inputCls} flex-1`} placeholder="Paste QR token here…" value={qrInput} onChange={e => setQrInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleScanQr(qrInput); }} />
                <button disabled={qrLoading || !qrInput.trim()} onClick={() => handleScanQr(qrInput)}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-lg disabled:opacity-50 flex items-center gap-2">
                  {qrLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Validate
                </button>
              </div>
            </div>
          </div>

          {scannedOrder && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-heading font-bold text-foreground">Order Details</h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">Paid — Ready to Dispense</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Patient</p>
                  <p className="font-semibold text-foreground">{scannedOrder.patientId?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{scannedOrder.patientId?.patientId}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Order ID</p>
                  <p className="font-semibold text-foreground font-mono text-xs">{scannedOrder.orderId}</p>
                  <p className="text-xs text-muted-foreground">Paid {scannedOrder.paidAt ? new Date(scannedOrder.paidAt).toLocaleDateString() : "—"}</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="pb-2 text-left font-medium">Medicine</th><th className="pb-2 text-left font-medium">Dosage</th><th className="pb-2 text-center font-medium">Qty</th><th className="pb-2 text-right font-medium">Price</th></tr></thead>
                <tbody>
                  {(scannedOrder.items || []).map((item: any, i: number) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-2.5 font-medium text-foreground">{item.name}{item.isPrescribed && <span className="ml-1.5 text-xs text-primary bg-primary/10 px-1.5 rounded">Rx</span>}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{item.dosage}</td>
                      <td className="py-2.5 text-center">×{item.requiredQty}</td>
                      <td className="py-2.5 text-right">₹{((item.unitPrice||0)*(item.requiredQty||1)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t border-border"><td colSpan={3} className="pt-2.5 font-semibold text-foreground">Total Paid</td><td className="pt-2.5 text-right font-semibold text-foreground">₹{(scannedOrder.total||0).toFixed(2)}</td></tr></tfoot>
              </table>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Notes (optional)</label>
                <textarea className={`${inputCls} resize-none`} rows={2} value={dispenseQrNotes} onChange={e => setDispenseQrNotes(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2 border-t border-border">
                <button onClick={() => { setScannedOrder(null); setQrInput(""); setQrError(""); }} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
                <button onClick={handleDispenseQr} disabled={dispenseQrLoading} className="flex-1 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-60 flex items-center justify-center gap-2">
                  {dispenseQrLoading && <RefreshCw className="w-4 h-4 animate-spin" />}<CheckCircle className="w-4 h-4" /> Confirm Dispense
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ INVENTORY ════ */}
      {tab === "inventory" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={medSearch} onChange={e => setMedSearch(e.target.value)} placeholder="Search medicines…" className="w-full pl-9 pr-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <select value={medCategoryFilter} onChange={e => setMedCategoryFilter(e.target.value)} className="px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="all">All Categories</option>
              {MEDICINE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => setShowLowStockOnly(x => !x)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${showLowStockOnly ? "gradient-primary text-primary-foreground border-transparent" : "border-border text-muted-foreground hover:text-foreground"}`}>
              <TrendingDown className="w-4 h-4" /> Low Stock
            </button>
            <button onClick={openAddMed} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-lg ml-auto">
              <Plus className="w-4 h-4" /> Add Medicine
            </button>
          </div>

          {filteredMeds.length === 0
            ? <EmptyState icon={Package} message="No medicines match the filter." />
            : (
              <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs">
                    <th className="px-4 py-3 text-left font-medium">Medicine</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-left font-medium">Dosage</th>
                    <th className="px-4 py-3 text-right font-medium">Cost</th>
                    <th className="px-4 py-3 text-right font-medium">Stock</th>
                    <th className="px-4 py-3 text-center font-medium">Actions</th>
                  </tr></thead>
                  <tbody>
                    {filteredMeds.map(m => (
                      <tr key={m._id} className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${m.quantity === 0 ? "bg-destructive/5" : m.quantity <= m.reorderLevel ? "bg-warning/5" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{m.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{m.medicineId}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.category}</td>
                        <td className="px-4 py-3 text-muted-foreground">{m.dosage}</td>
                        <td className="px-4 py-3 text-right text-foreground">₹{m.cost}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${m.quantity === 0 ? "text-destructive" : m.quantity <= m.reorderLevel ? "text-warning" : "text-foreground"}`}>{m.quantity} {m.unit}</span>
                          {m.quantity <= m.reorderLevel && <AlertTriangle className="w-3 h-3 text-warning inline ml-1" />}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => { setRestockMed(m); setRestockQty(""); setRestockNotes(""); setRestockError(""); setShowRestockModal(true); }}
                              className="text-xs px-2 py-1 border border-border rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                              Restock
                            </button>
                            <button onClick={() => openEditMed(m)} className="text-primary hover:text-primary/80"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => { setShowDeleteConfirm(m); setDeleteError(""); }} className="text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* ════ ALERTS ════ */}
      {tab === "alerts" && (
        <div className="space-y-4">
          {lowStock.length === 0
            ? <div className="bg-card border border-border rounded-xl p-8 text-center shadow-card"><ShieldAlert className="w-10 h-10 text-primary mx-auto mb-3" /><p className="text-sm font-medium text-foreground">All medicines are well stocked.</p></div>
            : lowStock.map(m => (
              <div key={m._id} className={`bg-card border rounded-xl p-5 shadow-card flex items-center justify-between ${m.quantity === 0 ? "border-destructive/40" : "border-warning/40"}`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Pill className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">{m.name}</p>
                    <span className="text-xs text-muted-foreground">{m.category} · {m.dosage}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Current: <strong className={m.quantity === 0 ? "text-destructive" : "text-warning"}>{m.quantity} {m.unit}</strong></span>
                    <span>Reorder at: {m.reorderLevel}</span>
                    {m.expiryDate && <span>Expires: {new Date(m.expiryDate).toLocaleDateString()}</span>}
                  </div>
                </div>
                <button onClick={() => { setRestockMed(m); setRestockQty(""); setRestockNotes(""); setRestockError(""); setShowRestockModal(true); }}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-lg">
                  Restock
                </button>
              </div>
            ))
          }
        </div>
      )}

      {/* ════ LOG ════ */}
      {tab === "log" && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-center">
            {(["all","dispensed","restock","adjustment","deleted"] as const).map(t => (
              <button key={t} onClick={() => { setLogTypeFilter(t); setLogPage(1); }}
                className={`px-3 py-1.5 text-xs rounded-full font-medium border transition-colors ${logTypeFilter === t ? "gradient-primary text-primary-foreground border-transparent" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {!txData || txData.transactions.length === 0
            ? <EmptyState icon={Inbox} message="No transactions found." />
            : (
              <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs">
                    <th className="px-4 py-3 text-left font-medium">Medicine</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Change</th>
                    <th className="px-4 py-3 text-right font-medium">After</th>
                    <th className="px-4 py-3 text-left font-medium">By</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                  </tr></thead>
                  <tbody>
                    {txData.transactions.map(tx => (
                      <tr key={tx._id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium text-foreground">{tx.medicineName}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tx.type === "dispensed" ? "bg-primary/10 text-primary" : tx.type === "restock" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>{tx.type}</span></td>
                        <td className={`px-4 py-3 text-right font-bold ${tx.quantityChange > 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>{tx.quantityChange > 0 ? "+" : ""}{tx.quantityChange}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{tx.quantityAfter}</td>
                        <td className="px-4 py-3 text-muted-foreground">{tx.performedByName || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {txData.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">Page {txData.page} of {txData.totalPages} · {txData.total} total</p>
                    <div className="flex gap-2">
                      <button disabled={txData.page <= 1} onClick={() => setLogPage(p => p - 1)} className="p-1.5 border border-border rounded-lg disabled:opacity-40 hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
                      <button disabled={txData.page >= txData.totalPages} onClick={() => setLogPage(p => p + 1)} className="p-1.5 border border-border rounded-lg disabled:opacity-40 hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </div>
            )
          }
        </div>
      )}

      {/* ════ SETTINGS ════ */}
      {tab === "settings" && (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-card border border-border rounded-xl p-6 shadow-card">
            <SectionHeader title="Edit Profile" />
            <form onSubmit={handleUpdateProfile} className="space-y-4 mt-3">
              {([["Full Name","name","text"],["Phone","phoneNumber","tel"],["Designation","designation","text"]] as [string, keyof typeof profileForm, string][]).map(([label,key,type]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">{label}</label>
                  <input type={type} value={profileForm[key]} onChange={e => setProfileForm(f => ({ ...f, [key]: e.target.value }))} className={inputCls} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                <input value={pharmacist?.email || ""} disabled className={`${inputCls} opacity-50 cursor-not-allowed`} />
              </div>
              <button type="submit" disabled={profileLoading} className="px-5 py-2 text-sm font-semibold text-primary-foreground gradient-primary rounded-lg disabled:opacity-60 flex items-center gap-2">
                {profileLoading && <RefreshCw className="w-4 h-4 animate-spin" />} Save Changes
              </button>
            </form>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-card">
            <SectionHeader title="Activity Summary" />
            <div className="text-sm divide-y divide-border mt-3">
              {([
                ["Total Prescriptions", prescriptions.length],
                ["Pending", prescriptions.filter(p => p.status === "pending").length],
                ["Dispensed", prescriptions.filter(p => p.status === "dispensed").length],
                ["Low Stock Items", lowStock.length],
                ["Medicines in Inventory", medicines.length],
              ] as [string, number][]).map(([label, value]) => (
                <div key={label} className="flex justify-between py-2.5">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </TabErrorBoundary>
    </DashboardLayout>

    {/* ════ MODALS ════ */}

    {showMedModal && (
      <Modal title={editingMed ? `Edit — ${editingMed.name}` : "Add Medicine"} onClose={() => setShowMedModal(false)} width="max-w-2xl">
        <form onSubmit={handleSaveMed} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-1">Medicine Name *</label>
              <input required value={medForm.name} onChange={e => setMedForm(f => ({ ...f, name:e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Category</label>
              <select value={medForm.category} onChange={e => setMedForm(f => ({ ...f, category:e.target.value }))} className={inputCls}>
                {MEDICINE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Dosage *</label>
              <input required value={medForm.dosage} onChange={e => setMedForm(f => ({ ...f, dosage:e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Manufacturer</label>
              <input value={medForm.manufacturer} onChange={e => setMedForm(f => ({ ...f, manufacturer:e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Batch Number</label>
              <input value={medForm.batchNumber} onChange={e => setMedForm(f => ({ ...f, batchNumber:e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Expiry Date</label>
              <input type="date" value={medForm.expiryDate} onChange={e => setMedForm(f => ({ ...f, expiryDate:e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Unit</label>
              <input value={medForm.unit} onChange={e => setMedForm(f => ({ ...f, unit:e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Cost per unit (₹) *</label>
              <input required type="number" min="0" step="0.01" value={medForm.cost} onChange={e => setMedForm(f => ({ ...f, cost:e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Quantity *</label>
              <input required type="number" min="0" value={medForm.quantity} onChange={e => setMedForm(f => ({ ...f, quantity:e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Reorder Level</label>
              <input type="number" min="0" value={medForm.reorderLevel} onChange={e => setMedForm(f => ({ ...f, reorderLevel:e.target.value }))} className={inputCls} />
              <p className="text-xs text-muted-foreground mt-1">Alert when stock falls to or below this level.</p>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
              <textarea value={medForm.description} onChange={e => setMedForm(f => ({ ...f, description:e.target.value }))} className={`${inputCls} resize-none`} rows={2} />
            </div>
          </div>
          {medError   && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{medError}</p>}
          {medSuccess && <p className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">{medSuccess}</p>}
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" onClick={() => setShowMedModal(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button type="submit" disabled={medLoading} className="px-5 py-2 text-sm font-semibold text-primary-foreground gradient-primary rounded-lg disabled:opacity-60 flex items-center gap-2">
              {medLoading && <RefreshCw className="w-4 h-4 animate-spin" />} {editingMed ? "Save Changes" : "Add Medicine"}
            </button>
          </div>
        </form>
      </Modal>
    )}

    {showRestockModal && restockMed && (
      <Modal title={`Restock — ${restockMed.name}`} onClose={() => setShowRestockModal(false)}>
        <form onSubmit={handleRestock} className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground">Current: <strong className={restockMed.quantity === 0 ? "text-destructive" : "text-foreground"}>{restockMed.quantity} {restockMed.unit}</strong> · Reorder level: <strong className="text-foreground">{restockMed.reorderLevel}</strong></p>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Quantity to Add *</label>
            <input required autoFocus type="number" min="1" value={restockQty} onChange={e => setRestockQty(e.target.value)} className={inputCls} />
            {restockQty && <p className="text-xs text-muted-foreground mt-1">New stock: <strong className="text-foreground">{restockMed.quantity + Number(restockQty)} {restockMed.unit}</strong></p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Notes (optional)</label>
            <input value={restockNotes} onChange={e => setRestockNotes(e.target.value)} className={inputCls} />
          </div>
          {restockError && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{restockError}</p>}
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" onClick={() => setShowRestockModal(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button type="submit" disabled={restockLoading} className="px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-60 flex items-center gap-2">
              {restockLoading && <RefreshCw className="w-4 h-4 animate-spin" />} Confirm Restock
            </button>
          </div>
        </form>
      </Modal>
    )}

    {showDeleteConfirm && (
      <Modal title="Delete Medicine" onClose={() => setShowDeleteConfirm(null)}>
        <div className="space-y-3 text-sm">
          <p className="text-foreground">Delete <strong>{showDeleteConfirm.name}</strong> from inventory?</p>
          <p className="text-muted-foreground">This cannot be undone.</p>
          {deleteError && <p className="text-destructive bg-destructive/10 rounded-lg px-3 py-2">{deleteError}</p>}
        </div>
        <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-border">
          <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
          <button onClick={handleDeleteMed} disabled={deleteLoading} className="px-5 py-2 text-sm font-semibold text-white bg-destructive hover:bg-destructive/90 rounded-lg disabled:opacity-60 flex items-center gap-2">
            {deleteLoading && <RefreshCw className="w-4 h-4 animate-spin" />} Delete Medicine
          </button>
        </div>
      </Modal>
    )}

    {showDispenseModal && (
      <Modal title="Confirm Dispensing" onClose={() => setShowDispenseModal(null)} width="max-w-xl">
        <div className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-3 text-sm">
            <p className="font-medium text-foreground">{showDispenseModal.patientId?.name}</p>
            <p className="text-muted-foreground">Prescription: {showDispenseModal.prescriptionId}</p>
          </div>
          {showDispenseModal.medicines?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Stock verification:</p>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border text-muted-foreground"><th className="pb-1.5 text-left font-medium">Medicine</th><th className="pb-1.5 text-center font-medium">Required</th><th className="pb-1.5 text-center font-medium">In Stock</th><th className="pb-1.5 text-center font-medium">Status</th></tr></thead>
                <tbody>
                  {showDispenseModal.medicines.map((m, i) => {
                    const required  = calcRequiredQty(m);
                    const available = m.medicineId?.quantity ?? null;
                    const ok        = available === null || available >= required;
                    return (
                      <tr key={i} className={`border-b border-border last:border-0 ${!ok ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                        <td className="py-2 font-medium text-foreground">{m.name || m.medicineId?.name || "—"}</td>
                        <td className="py-2 text-center">{required}</td>
                        <td className={`py-2 text-center font-bold ${available === null ? "text-muted-foreground" : ok ? "text-green-600" : "text-destructive"}`}>{available ?? "?"}</td>
                        <td className="py-2 text-center">{ok ? <span className="text-green-600">✓ OK</span> : <span className="text-destructive font-semibold">✗ Low</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Notes (optional)</label>
            <textarea value={dispenseNotes} onChange={e => setDispenseNotes(e.target.value)} className={`${inputCls} resize-none`} rows={2} />
          </div>
          {dispenseError && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{dispenseError}</p>}
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" onClick={() => setShowDispenseModal(null)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button onClick={handleDispense} disabled={dispenseLoading} className="px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-60 flex items-center gap-2">
              {dispenseLoading && <RefreshCw className="w-4 h-4 animate-spin" />} Confirm Dispense
            </button>
          </div>
        </div>
      </Modal>
    )}

    {showFlagModal && (
      <Modal title="Flag Prescription" onClose={() => setShowFlagModal(null)}>
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm">
            <p className="font-medium text-red-700 dark:text-red-400">⚠ This will cancel the prescription.</p>
            <p className="text-muted-foreground mt-1">{showFlagModal.patientId?.name} — {showFlagModal.prescriptionId}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Reason *</label>
            <textarea required value={flagNotes} onChange={e => setFlagNotes(e.target.value)} className={`${inputCls} resize-none`} rows={3} />
          </div>
          {flagError && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{flagError}</p>}
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" onClick={() => setShowFlagModal(null)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button onClick={handleFlag} disabled={flagLoading || !flagNotes.trim()} className="px-5 py-2 text-sm font-semibold text-white bg-destructive hover:bg-destructive/90 rounded-lg disabled:opacity-60 flex items-center gap-2">
              {flagLoading && <RefreshCw className="w-4 h-4 animate-spin" />} Flag & Cancel
            </button>
          </div>
        </div>
      </Modal>
    )}
    </>
  );
};

export default PharmacistDashboard;
