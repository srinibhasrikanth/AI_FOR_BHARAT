import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { publicApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Activity, AlertTriangle, RefreshCw, Phone, Droplets, User, Calendar, Globe, Heart, ShieldAlert } from "lucide-react";

const PatientEmergencyPage = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // If a logged-in doctor opens this URL (e.g. by scanning via phone camera),
  // redirect them to the doctor consultation view with the patient pre-loaded.
  useEffect(() => {
    if (isAuthenticated && user?.role === "doctor" && patientId) {
      navigate(`/dashboard/doctor?tab=consultation`, { replace: true });
    }
  }, [isAuthenticated, user, patientId, navigate]);

  useEffect(() => {
    // Skip public fetch if we're about to redirect a doctor
    if (isAuthenticated && user?.role === "doctor") return;
    if (!patientId) {
      setError("Invalid QR code — no patient ID found.");
      setLoading(false);
      return;
    }
    publicApi
      .getPatientEmergencyInfo(patientId)
      .then((res) => setPatient(res.data))
      .catch((err) => setError(err.message || "Patient record not found."))
      .finally(() => setLoading(false));
  }, [patientId, isAuthenticated, user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 flex flex-col items-center justify-start p-4">
      {/* Header */}
      <div className="w-full max-w-md mt-6 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-red-500" />
          <span className="font-bold text-lg text-gray-800 dark:text-white">MediFlow</span>
        </div>
        <span className="text-xs font-semibold px-3 py-1 bg-red-100 text-red-700 rounded-full border border-red-200">
          🚨 EMERGENCY INFO
        </span>
      </div>

      <div className="w-full max-w-md">
        {loading && (
          <div className="flex flex-col items-center gap-3 py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
            <p className="text-sm text-gray-500">Loading patient information…</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-white dark:bg-gray-900 border border-red-200 rounded-2xl p-8 text-center shadow-lg">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Unable to Load Record</h2>
            <p className="text-sm text-gray-500">{error}</p>
            <Link to="/" className="mt-6 inline-block text-sm text-red-600 underline">Go to MediFlow</Link>
          </div>
        )}

        {!loading && patient && (
          <div className="space-y-4">
            {/* Main card */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden border border-red-100">
              {/* Patient name header */}
              <div className="bg-red-500 px-6 py-5 text-white">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-3 text-2xl font-bold">
                  {patient.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <h1 className="text-xl font-bold">{patient.name || "Unknown"}</h1>
                <p className="text-red-100 text-sm mt-0.5">{patient.patientId || ""}</p>
              </div>

              {/* Key vitals row */}
              <div className="grid grid-cols-2 gap-px bg-gray-100 dark:bg-gray-800">
                <div className="bg-white dark:bg-gray-900 px-4 py-3 text-center">
                  <Droplets className="w-5 h-5 text-red-500 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">Blood Group</p>
                  <p className="font-bold text-lg text-gray-800 dark:text-white">{patient.bloodGroup || "—"}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 px-4 py-3 text-center">
                  <User className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">Gender</p>
                  <p className="font-bold text-sm text-gray-800 dark:text-white capitalize">{patient.gender?.replace("_", " ") || "—"}</p>
                </div>
              </div>

              {/* Details */}
              <div className="px-6 py-4 space-y-3">
                {patient.dob && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Date of Birth</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{patient.dob}</p>
                    </div>
                  </div>
                )}

                {patient.phoneNumber && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Contact</p>
                      <a href={`tel:${patient.phoneNumber}`} className="text-sm font-medium text-red-600 underline">{patient.phoneNumber}</a>
                    </div>
                  </div>
                )}

                {(patient.languagesKnown || []).length > 0 && (
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Languages</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{patient.languagesKnown.join(", ")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Conditions */}
            {(patient.conditions || []).length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow border border-orange-100 px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="w-4 h-4 text-orange-500" />
                  <h2 className="font-semibold text-gray-800 dark:text-white text-sm">Known Medical Conditions</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {patient.conditions.map((c: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-full text-xs font-medium capitalize">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Allergies */}
            {(patient.allergies || []).length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow border border-red-200 px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                  <h2 className="font-semibold text-red-700 text-sm">⚠ Known Allergies</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {patient.allergies.map((a: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-medium capitalize">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Emergency Contacts */}
            {(patient.emergencyContacts || []).filter((ec: any) => ec.name && ec.phoneNumber).length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow border border-orange-200 px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Phone className="w-4 h-4 text-orange-500" />
                  <h2 className="font-semibold text-orange-700 text-sm">Emergency Contacts</h2>
                </div>
                <div className="space-y-2">
                  {patient.emergencyContacts.filter((ec: any) => ec.name && ec.phoneNumber).map((ec: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-orange-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-white">{ec.name}</p>
                        {ec.relation && <p className="text-xs text-gray-500">{ec.relation}{ec.address ? ` · ${ec.address}` : ""}</p>}
                      </div>
                      <a href={`tel:${ec.phoneNumber}`} className="flex items-center gap-1.5 text-sm font-semibold text-orange-600 underline">
                        <Phone className="w-3.5 h-3.5" />{ec.phoneNumber}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer disclaimer */}
            <div className="text-center text-xs text-gray-400 pb-6 px-2">
              This page is intended for emergency responders only. For full medical records, login is required.
              <br />
              <Link to="/"  className="text-red-500 underline mt-1 inline-block">MediFlow Platform</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientEmergencyPage;
