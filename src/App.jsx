import { useState, useEffect } from "react";
import PulseNav from "./components/PulseNav";
import MedSyncHome from "./components/MedSyncHome";
import ReliefLaserHealth from "./components/ReliefLaserHealth";
import UploadBox from "./components/UploadBox";
import ResultCard from "./components/ResultCard";
import Summary from "./components/Summary";
import AttentionCard from "./components/AttentionCard";
import RiskPage from "./components/RiskPage";
import CostHubPage from "./components/CostHubPage";
import DoctorReferralDesk from "./components/DoctorReferralDesk";
import HospitalManagement from "./components/HospitalManagement";
import PatientDashboard from "./components/PatientDashboard";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import { computeRisk } from "./utils/riskEngine";
import { extractLines } from "./utils/extractText";
import { parseLines } from "./utils/parseReport";
import { analyze } from "./utils/analyze";
import { saveReportToVault } from "./utils/offlineStorage";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { useLanguage } from "./context/LanguageContext";
import { useAuth } from "./context/AuthContext";
import "./App.css";

export default function App() {
  const { role, isDoctor, isHospital, isPatient, isAdmin } = useAuth();
  const { t } = useLanguage();

  const parseCurrentRoute = () => {
    if (typeof window === "undefined") return { page: "home", subRoute: "dashboard" };
    const path = window.location.pathname.toLowerCase();

    if (path.startsWith("/patient")) {
      const parts = path.split("/").filter(Boolean);
      return { page: "patient", subRoute: parts[1] || "dashboard" };
    }
    if (path.startsWith("/doctor")) {
      const parts = path.split("/").filter(Boolean);
      return { page: "doctor", subRoute: parts[1] || "dashboard" };
    }
    if (path.startsWith("/hospital")) {
      const parts = path.split("/").filter(Boolean);
      return { page: "hospital", subRoute: parts[1] || "dashboard" };
    }
    if (path.startsWith("/admin")) {
      const parts = path.split("/").filter(Boolean);
      return { page: "admin", subRoute: parts[1] || "dashboard" };
    }
    if (path.startsWith("/relief-laser-health")) {
      return { page: "relief", subRoute: "overview" };
    }
    if (path.startsWith("/report")) {
      return { page: "report", subRoute: "" };
    }
    if (path.startsWith("/risk")) {
      return { page: "risk", subRoute: "" };
    }
    if (path.startsWith("/cost")) {
      return { page: "cost", subRoute: "" };
    }
    if (path.startsWith("/bot")) {
      return { page: "home", subRoute: "" };
    }
    return { page: "home", subRoute: "" };
  };

  const initialRoute = parseCurrentRoute();
  const [activePage, setActivePage] = useState(initialRoute.page);
  const [subRoute, setSubRoute] = useState(initialRoute.subRoute);
  const [unauthorizedMessage, setUnauthorizedMessage] = useState(null);

  const [results, setResults] = useState([]);
  const [activeReportName, setActiveReportName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleNavigate = (pageKey, explicitSubRoute = null) => {
    let targetPage = pageKey;
    let targetSub = explicitSubRoute || "dashboard";
    let targetPath = "/";

    // Map navigation keys to role-specific routes
    if (pageKey === "home") {
      targetPage = "home";
      targetPath = "/";
    } else if (pageKey === "patient_dashboard") {
      targetPage = "patient";
      targetSub = "dashboard";
      targetPath = "/patient/dashboard";
    } else if (pageKey === "patient_referrals") {
      targetPage = "patient";
      targetSub = "referrals";
      targetPath = "/patient/referrals";
    } else if (pageKey === "patient") {
      targetPage = "patient";
      targetSub = explicitSubRoute || "dashboard";
      targetPath = `/patient/${targetSub}`;
    } else if (pageKey === "doctor_dashboard") {
      targetPage = "doctor";
      targetSub = "dashboard";
      targetPath = "/doctor/dashboard";
    } else if (pageKey === "doctor_create") {
      targetPage = "doctor";
      targetSub = "create-referral";
      targetPath = "/doctor/create-referral";
    } else if (pageKey === "doctor_patients") {
      targetPage = "doctor";
      targetSub = "patients";
      targetPath = "/doctor/patients";
    } else if (pageKey === "doctor_referrals") {
      targetPage = "doctor";
      targetSub = "referrals";
      targetPath = "/doctor/referrals";
    } else if (pageKey === "doctor") {
      targetPage = "doctor";
      targetSub = explicitSubRoute || "dashboard";
      targetPath = `/doctor/${targetSub}`;
    } else if (pageKey === "hospital_dashboard") {
      targetPage = "hospital";
      targetSub = "dashboard";
      targetPath = "/hospital/dashboard";
    } else if (pageKey === "hospital_incoming") {
      targetPage = "hospital";
      targetSub = "incoming-referrals";
      targetPath = "/hospital/incoming-referrals";
    } else if (pageKey === "hospital_capacity") {
      targetPage = "hospital";
      targetSub = "capacity";
      targetPath = "/hospital/capacity";
    } else if (pageKey === "hospital_verify") {
      targetPage = "hospital";
      targetSub = "verification";
      targetPath = "/hospital/verification";
    } else if (pageKey === "hospital") {
      targetPage = "hospital";
      targetSub = explicitSubRoute || "dashboard";
      targetPath = `/hospital/${targetSub}`;
    } else if (pageKey === "admin_dashboard") {
      targetPage = "admin";
      targetSub = "dashboard";
      targetPath = "/admin/dashboard";
    } else if (pageKey === "admin_doctors") {
      targetPage = "admin";
      targetSub = "doctors";
      targetPath = "/admin/doctors";
    } else if (pageKey === "admin_hospitals") {
      targetPage = "admin";
      targetSub = "hospitals";
      targetPath = "/admin/hospitals";
    } else if (pageKey === "admin_referrals") {
      targetPage = "admin";
      targetSub = "referrals";
      targetPath = "/admin/referrals";
    } else if (pageKey === "admin") {
      targetPage = "admin";
      targetSub = explicitSubRoute || "dashboard";
      targetPath = `/admin/${targetSub}`;
    } else if (pageKey === "relief") {
      targetPage = "relief";
      targetPath = "/relief-laser-health";
    } else if (pageKey === "report") {
      if (isPatient) {
        targetPage = "patient";
        targetSub = "reports";
        targetPath = "/patient/reports";
      } else {
        targetPage = "report";
        targetPath = "/report";
      }
    } else if (pageKey === "risk") {
      targetPage = "risk";
      targetPath = "/risk";
    } else if (pageKey === "cost") {
      targetPage = "cost";
      targetPath = "/cost";
    }

    // ── STRICT RBAC ROLE GUARD ENFORCEMENT ──
    if (targetPage === "doctor" && !isDoctor && !isAdmin) {
      setUnauthorizedMessage(
        `Access Denied: You are authenticated as a ${role.toUpperCase()}. Doctor Portal features and referral creation are restricted to verified medical practitioners.`
      );
      targetPage = isHospital ? "hospital" : "patient";
      targetSub = "dashboard";
      targetPath = isHospital ? "/hospital/dashboard" : "/patient/dashboard";
    } else if (targetPage === "hospital" && !isHospital && !isAdmin) {
      setUnauthorizedMessage(
        `Access Denied: You are authenticated as a ${role.toUpperCase()}. Hospital Portal triage and bed telemetry are restricted to authorized hospital administration desks.`
      );
      targetPage = isDoctor ? "doctor" : "patient";
      targetSub = "dashboard";
      targetPath = isDoctor ? "/doctor/dashboard" : "/patient/dashboard";
    } else if (targetPage === "admin" && !isAdmin) {
      setUnauthorizedMessage(
        `Access Denied: Super Administrator privileges are required to access governance and audit controls.`
      );
      targetPage = isDoctor ? "doctor" : isHospital ? "hospital" : "patient";
      targetSub = "dashboard";
      targetPath = `/${targetPage}/dashboard`;
    } else {
      setUnauthorizedMessage(null);
    }

    setActivePage(targetPage);
    setSubRoute(targetSub);

    if (typeof window !== "undefined" && window.history) {
      window.history.pushState({ page: targetPage, subRoute: targetSub }, "", targetPath);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  useEffect(() => {
    const onPopState = () => {
      const parsed = parseCurrentRoute();
      setActivePage(parsed.page);
      setSubRoute(parsed.subRoute);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Auto-route authenticated Doctor, Hospital, or Admin to their dedicated portal workspace
  useEffect(() => {
    if (activePage === "home" && (window.location.pathname === "/" || window.location.pathname === "")) {
      if (isDoctor) {
        handleNavigate("doctor_dashboard");
      } else if (isHospital) {
        handleNavigate("hospital_dashboard");
      } else if (isAdmin) {
        handleNavigate("admin_dashboard");
      }
    }
  }, [isDoctor, isHospital, isAdmin]);

  async function handleFile(file) {
    setLoading(true);
    setError("");
    try {
      const lines = await extractLines(file);
      const parsed = await Promise.all(parseLines(lines).map(analyze));
      if (parsed.length === 0) {
        setError(t("report.errNoTests"));
      } else {
        const reportName = file.name || t("report.fallbackName");
        setResults(parsed);
        setActiveReportName(reportName);
        saveReportToVault(parsed, reportName);
        if (isPatient) {
          handleNavigate("patient", "reports");
        } else {
          setActivePage("report");
        }
      }
    } catch (e) {
      console.error(e);
      setError(t("report.errReadPdf"));
    }
    setLoading(false);
  }

  async function loadSample() {
    try {
      setError("");
      const res = await fetch("/sample_lab_report.pdf");
      const blob = await res.blob();
      if (!res.ok || blob.type.includes("html")) {
        throw new Error("not found");
      }
      const file = new File([blob], "sample_lab_report.pdf", { type: "application/pdf" });
      await handleFile(file);
    } catch (e) {
      setError(t("report.errLoadSample"));
    }
  }

  return (
    <div className="app">
      {/* ── Unique ECG Heartbeat Pulse Navbar ── */}
      <PulseNav
        activePage={activePage}
        onNavigate={handleNavigate}
        userEmail={auth.currentUser?.email}
        onLogout={() => signOut(auth)}
        resultsCount={results.length}
        riskScore={results.length > 0 ? computeRisk(results).score : undefined}
      />

      {/* ── Security Toast for Blocked Role Attempts ── */}
      {unauthorizedMessage && (
        <div 
          className="dash-alert error" 
          style={{ 
            maxWidth: "960px", 
            margin: "1rem auto 0", 
            padding: "12px 18px", 
            borderRadius: "10px", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            boxShadow: "0 4px 12px rgba(239, 68, 68, 0.15)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>🛡️</span>
            <span>{unauthorizedMessage}</span>
          </div>
          <button
            type="button"
            className="notif-close-btn"
            onClick={() => setUnauthorizedMessage(null)}
            style={{ color: "#b91c1c" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── 1. MedSync AI Home Screen ── */}
      {activePage === "home" && (
        <main className="page-fade">
          <MedSyncHome
            userEmail={auth.currentUser?.email}
            onNavigate={handleNavigate}
            results={results}
          />
        </main>
      )}

      {/* ── 2. Patient Portal (/patient/*) ── */}
      {activePage === "patient" && (
        <main className="page-fade">
          <PatientDashboard
            userEmail={auth.currentUser?.email}
            activeSubRoute={subRoute}
            onSubRouteChange={(sub) => handleNavigate("patient", sub)}
            results={results}
            onFile={handleFile}
            onNavigate={handleNavigate}
          />
        </main>
      )}

      {/* ── 3. Doctor Portal (/doctor/*) ── */}
      {activePage === "doctor" && (
        <main className="page-fade">
          <DoctorReferralDesk
            userEmail={auth.currentUser?.email}
            results={results}
            activeSubRoute={subRoute}
            onSubRouteChange={(sub) => handleNavigate("doctor", sub)}
            onNavigateToPass={() => handleNavigate("doctor", "referrals")}
          />
        </main>
      )}

      {/* ── 4. Hospital Portal (/hospital/*) ── */}
      {activePage === "hospital" && (
        <main className="page-fade">
          <HospitalManagement
            userEmail={auth.currentUser?.email}
            activeSubRoute={subRoute}
            onSubRouteChange={(sub) => handleNavigate("hospital", sub)}
            onNavigateToDoctor={() => handleNavigate("doctor", "dashboard")}
          />
        </main>
      )}

      {/* ── 5. Super Admin Governance Portal (/admin/*) ── */}
      {activePage === "admin" && (
        <main className="page-fade">
          <SuperAdminDashboard
            userEmail={auth.currentUser?.email}
            activeSubRoute={subRoute}
            onSubRouteChange={(sub) => handleNavigate("admin", sub)}
          />
        </main>
      )}

      {/* ── 6. Relief Laser Health (Network Overview) ── */}
      {activePage === "relief" && (
        <main className="page-fade">
          <ReliefLaserHealth
            userEmail={auth.currentUser?.email}
            onNavigate={handleNavigate}
            results={results}
          />
        </main>
      )}

      {/* ── 7. Diagnostic Report Analyzer ── */}
      {activePage === "report" && (
        <main className="page-fade">
          <header>
            <div className="report-header-top">
              <h1>{t("report.title")}</h1>
              {activeReportName && (
                <span className="offline-active-indicator" title={t("report.savedToVault")}>
                  <span className="rec-dot" />
                  <span>{t("report.emrPrefix")} {activeReportName}</span>
                </span>
              )}
            </div>
            <p className="tag">
              {t("report.tag")}
            </p>
          </header>

          <UploadBox onFile={handleFile} loading={loading} loadSample={loadSample} />

          {error && <p className="error" role="alert">{error}</p>}

          {results.length > 0 && (
            <>
              {/* Dual Action Telemetry Banner */}
              <div className="risk-jump-banner">
                <div>
                  <strong>{t("report.bannerTitle")}</strong>
                  <p>{t("report.bannerDesc", { count: results.length })}</p>
                </div>
                <div className="banner-btn-group">
                  <button
                    className="risk-jump-btn"
                    onClick={() => handleNavigate("risk")}
                  >
                    {t("report.btnDeterioration")}
                  </button>
                </div>
              </div>

              <Summary results={results} />
              <AttentionCard results={results} />
              {[...results]
                .sort(
                  (a, b) =>
                    (b.needsAttention - a.needsAttention) ||
                    ((b.status !== "normal") - (a.status !== "normal"))
                )
                .map((r) => (
                  <ResultCard key={r.test.name} r={r} />
                ))}
            </>
          )}

          <footer>
            {t("common.disclaimer")}
          </footer>
        </main>
      )}

      {/* ── 8. Alerts (Deterioration AI) ── */}
      {activePage === "risk" && (
        <main className="page-fade">
          <RiskPage results={results} onNavigate={handleNavigate} />
        </main>
      )}

      {/* ── 9. Hospital Costs Hub ── */}
      {activePage === "cost" && (
        <main className="page-fade">
          <CostHubPage results={results} />
        </main>
      )}
    </div>
  );
}
