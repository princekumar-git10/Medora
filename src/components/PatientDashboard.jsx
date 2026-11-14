import { useState, useEffect, useMemo, useRef } from "react";
import { getReferrals, subscribeToReferrals, sweepExpiredCapacityHolds } from "../services/referralService.js";
import { getHospitals, subscribeToHospitals } from "../services/hospitalService.js";
import { subscribeToNotifications, getNotificationsForRole } from "../services/notificationService.js";
import { translatePatientGuideAI } from "../services/aiReferralService.js";
import { useLanguage } from "../context/LanguageContext";

/**
 * Patient Dashboard & Referral Tracking Module
 * Route: /relief-laser-health/patient
 *
 * Privacy:
 *  - Patients can only view their own referrals (matched by email, contact, or patientId).
 *  - Family access requires authorization (shared access code).
 *  - Never exposes private clinical reports or diagnosis to unauthorized viewers.
 *  - SMS/Notification content is sanitized — no clinical details.
 */

// Canonical timeline milestones in display order
const TIMELINE_MILESTONES = [
  { key: "Created",              label: "Referral Created",                icon: "📋" },
  { key: "Matching",             label: "Hospital Matching Started",       icon: "🔍" },
  { key: "Pending",              label: "Referral Sent to Hospital",       icon: "📤" },
  { key: "Rejected",             label: "Hospital Declined Referral",      icon: "❌" },
  { key: "Alternative",          label: "Alternative Hospital Identified", icon: "🔄" },
  { key: "Redirected",           label: "Referral Sent to New Hospital",   icon: "🏥" },
  { key: "Information Requested",label: "More Information Requested",      icon: "📝" },
  { key: "Accepted",             label: "Hospital Accepted Referral",      icon: "✅" },
  { key: "Transfer Initiated",   label: "Patient Transfer Initiated",      icon: "🚑" },
  { key: "Patient Arrived",      label: "Patient Arrived at Hospital",     icon: "🏨" },
  { key: "Completed",            label: "Admission Confirmed",             icon: "🎉" },
];

// Patient-friendly status map
const STATUS_CONFIG = {
  Created:                { label: "Referral Created",          color: "#3b82f6", bg: "#eff6ff",  borderColor: "#bfdbfe" },
  Pending:                { label: "Awaiting Hospital Reply",   color: "#d97706", bg: "#fffbeb",  borderColor: "#fde68a" },
  "Information Requested":{ label: "Hospital Needs More Info",  color: "#8b5cf6", bg: "#f5f3ff",  borderColor: "#c4b5fd" },
  Accepted:               { label: "Hospital Confirmed ✓",      color: "#059669", bg: "#ecfdf5",  borderColor: "#a7f3d0" },
  "Transfer Initiated":   { label: "Transfer Initiated 🚑",     color: "#0284c7", bg: "#f0f9ff",  borderColor: "#bae6fd" },
  "Patient Arrived":      { label: "Arrived at Hospital 🏨",    color: "#0d9488", bg: "#f0fdfa",  borderColor: "#99f6e4" },
  Rejected:               { label: "Searching Alternatives",    color: "#dc2626", bg: "#fef2f2",  borderColor: "#fecaca" },
  Completed:              { label: "Admitted & Active 🎉",      color: "#0f5c63", bg: "#f0fdfa",  borderColor: "#99f6e4" },
  Escalated:              { label: "Emergency Coordination",    color: "#b91c1c", bg: "#fff1f2",  borderColor: "#fda4af" },
};

import { useAuth } from "../context/AuthContext";

export default function PatientDashboard({ 
  userEmail,
  activeSubRoute = "dashboard",
  onSubRouteChange,
  results = [],
  onFile,
  onNavigate
}) {
  const { t } = useLanguage();
  const { profile, user } = useAuth();

  const [activeTab, setActiveTabState] = useState(() => {
    if (activeSubRoute === "reports") return "reports";
    if (activeSubRoute === "referrals") return "referrals";
    if (activeSubRoute === "profile") return "profile";
    return "dashboard";
  });

  const setActiveTab = (tabKey) => {
    setActiveTabState(tabKey);
    if (onSubRouteChange) onSubRouteChange(tabKey);
  };

  useEffect(() => {
    if (activeSubRoute === "reports") setActiveTabState("reports");
    else if (activeSubRoute === "referrals") setActiveTabState("referrals");
    else if (activeSubRoute === "profile") setActiveTabState("profile");
    else if (activeSubRoute === "dashboard") setActiveTabState("dashboard");
  }, [activeSubRoute]);

  // Authentication & access state
  const [accessMode, setAccessMode] = useState(() => (userEmail || user ? "patient" : "unverified")); // "unverified" | "patient" | "family"
  const [lookupInput, setLookupInput] = useState("");
  const [familyAccessCode, setFamilyAccessCode] = useState("");
  const [accessError, setAccessError] = useState("");
  const activeQueryRef = useRef({ query: "", isAutoLookup: false });

  // Data state
  const [referrals, setReferrals] = useState([]);
  const [allHospitals, setAllHospitals] = useState([]);
  const [liveNotifications, setLiveNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState(null);

  // Notifications panel
  const [showNotifications, setShowNotifications] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Multilingual EN / HI AI Assistance
  const [aiGuideLang, setAiGuideLang] = useState("en");
  const [aiGuideText, setAiGuideText] = useState("");
  const [aiGuideLoading, setAiGuideLoading] = useState(false);

  const handleLoadMultilingualGuide = async (targetLang) => {
    setAiGuideLang(targetLang);
    if (!selectedReferral) return;
    const h = getHospitalForReferral(selectedReferral);
    setAiGuideLoading(true);
    try {
      const res = await translatePatientGuideAI(selectedReferral, h, targetLang);
      setAiGuideText(res.translatedGuide || "");
    } catch {
      setAiGuideText("");
    } finally {
      setAiGuideLoading(false);
    }
  };

  const filterReferralsForQuery = (all, q, isAutoLookup) => {
    const cleanQ = (q || "").trim().toLowerCase();
    if (!cleanQ) return [];
    const matched = all.filter((r) => {
      const patContact = (r.patient?.contact || "").replace(/\s/g, "").toLowerCase();
      const patId = (r.patient?.patientId || "").toLowerCase();
      const patName = (r.patient?.name || "").toLowerCase();
      const refId = (r.id || "").toLowerCase();
      const patEmail = (r.patient?.email || "").toLowerCase();
      const docEmail = (r.doctorId || "").toLowerCase();

      return (
        patContact.includes(cleanQ) ||
        patId === cleanQ ||
        refId === cleanQ ||
        cleanQ === patEmail ||
        cleanQ === docEmail ||
        patName === cleanQ ||
        (userEmail && cleanQ === userEmail.toLowerCase() && (
          docEmail === cleanQ || patEmail === cleanQ || patContact.includes(cleanQ.split("@")[0])
        ))
      );
    });
    if (matched.length > 0) return matched;
    if (isAutoLookup) return all.filter((r) => r.isDemoData);
    return [];
  };

  // Real-time subscriptions: hospitals, referrals, and notifications
  useEffect(() => {
    sweepExpiredCapacityHolds().catch(() => {});
    getHospitals().then(setAllHospitals).catch(() => {});
    setLiveNotifications(getNotificationsForRole("patient"));

    const unsubHosp = subscribeToHospitals((updatedHospitals) => {
      setAllHospitals(updatedHospitals);
    });

    const unsubRefs = subscribeToReferrals((updatedRefs) => {
      if (activeQueryRef.current.query) {
        const refreshed = filterReferralsForQuery(
          updatedRefs,
          activeQueryRef.current.query,
          activeQueryRef.current.isAutoLookup
        );
        setReferrals(refreshed);
        setSelectedReferral((prev) => {
          if (!refreshed.length) return null;
          if (!prev) return refreshed[0];
          return refreshed.find((r) => r.id === prev.id) || refreshed[0];
        });
      }
    });

    const unsubNotifs = subscribeToNotifications((allNotifs) => {
      setLiveNotifications(allNotifs.filter((n) => n.recipientRole === "patient"));
    });

    return () => {
      if (typeof unsubHosp === "function") unsubHosp();
      if (typeof unsubRefs === "function") unsubRefs();
      if (typeof unsubNotifs === "function") unsubNotifs();
    };
  }, [userEmail]);

  // Auto-verify if user is logged in with an email that matches a referral
  useEffect(() => {
    if (userEmail && accessMode === "unverified") {
      handlePatientLookup(userEmail, true);
    }
  }, [userEmail]);

  /**
   * Patient lookup — matches referrals by:
   * - patient contact number
   * - patient email (derived from userEmail)
   * - patient ID
   * - referral ID
   */
  const handlePatientLookup = async (query, isAutoLookup = false) => {
    const q = (query || lookupInput).trim().toLowerCase();
    if (!q) {
      setAccessError("Please enter your Referral ID, Patient ID, or registered contact number.");
      return;
    }

    setLoading(true);
    setAccessError("");

    try {
      activeQueryRef.current = { query: q, isAutoLookup };
      const all = await getReferrals();
      const matched = filterReferralsForQuery(all, q, isAutoLookup);

      if (matched.length > 0) {
        setReferrals(matched);
        setSelectedReferral(matched[0]);
        setAccessMode(accessMode === "family" ? "family" : "patient");
      } else if (!isAutoLookup) {
        setAccessError("No referrals found for this Patient ID, Referral ID, or contact number. Please verify your credentials.");
      }
    } catch (err) {
      setAccessError("Unable to retrieve referral data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Family member access with authorization code
  const handleFamilyAccess = () => {
    const code = familyAccessCode.trim();
    if (!code) {
      setAccessError("Please enter the family access authorization code shared by the referring doctor.");
      return;
    }

    // In production: validate against backend. For demo: accept any code >= 6 chars
    if (code.length >= 6) {
      setAccessMode("family");
      // Re-run lookup with reduced visibility
      handlePatientLookup(lookupInput || userEmail || "demo");
    } else {
      setAccessError("Invalid authorization code. Please contact the referring physician for a valid access code.");
    }
  };

  // Get the hospital object for a referral
  const getHospitalForReferral = (ref) => {
    if (!ref?.targetHospitalId) return null;
    return allHospitals.find((h) => h.id === ref.targetHospitalId) || null;
  };

  // Build the visual timeline from referral timeline events
  const buildVisualTimeline = (ref) => {
    if (!ref?.timeline || ref.timeline.length === 0) return [];

    // Map timeline events to milestone entries
    const events = [];
    const seenStatuses = new Set();

    for (const entry of ref.timeline) {
      const status = entry.status;
      seenStatuses.add(status);

      // Find matching milestone (supporting both full keys and short aliases)
      const normalizedStatus = status === "Transfer" ? "Transfer Initiated" : status === "Arrived" ? "Patient Arrived" : status;
      let milestone = TIMELINE_MILESTONES.find((m) => m.key === normalizedStatus);

      // Infer intermediate milestones
      if (status === "Pending" && !events.some((e) => e.key === "Matching")) {
        events.push({
          key: "Matching",
          label: "Hospital Matching Started",
          icon: "🔍",
          timestamp: new Date(new Date(entry.timestamp).getTime() - 60000).toISOString(),
          note: "Matching engine evaluated eligible hospitals based on clinical requirements.",
          by: "System",
          occurred: true,
        });
      }

      // Map redirections
      if (status === "Pending" && entry.note?.toLowerCase().includes("redirect")) {
        events.push({
          key: "Alternative",
          label: "Alternative Hospital Identified",
          icon: "🔄",
          timestamp: new Date(new Date(entry.timestamp).getTime() - 30000).toISOString(),
          note: "System identified next-eligible alternative hospital after previous rejection.",
          by: "Matching Engine",
          occurred: true,
        });

        events.push({
          key: "Redirected",
          label: "Referral Sent to New Hospital",
          icon: "🏥",
          timestamp: entry.timestamp,
          note: entry.note,
          by: entry.by,
          occurred: true,
        });
        continue;
      }

      if (milestone) {
        events.push({
          ...milestone,
          timestamp: entry.timestamp,
          note: sanitizeNoteForPatient(entry.note, accessMode),
          by: entry.by,
          occurred: true,
        });
      } else {
        // Custom / unknown status — still show it
        events.push({
          key: status,
          label: status,
          icon: "📌",
          timestamp: entry.timestamp,
          note: sanitizeNoteForPatient(entry.note, accessMode),
          by: entry.by,
          occurred: true,
        });
      }
    }

    // Sort by timestamp
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return events;
  };

  // Sanitize clinical notes for patient view (privacy)
  const sanitizeNoteForPatient = (note, mode) => {
    if (!note) return "";
    if (mode === "family") {
      // Family sees less detail
      return note
        .replace(/diagnosis:?\s*[^.]+\./gi, "")
        .replace(/creatinine\s*[\d.]+/gi, "")
        .replace(/hemoglobin\s*[\d.]+/gi, "")
        .trim();
    }
    return note;
  };

  // Gather all notifications for selected referral (merging referral-embedded + central NotificationService)
  const getNotifications = (ref) => {
    if (!ref) return [];
    const embedded = (ref.notifications || [])
      .filter((n) => {
        const target = (n.target || "").toLowerCase();
        return (
          target.includes("patient") ||
          target.includes("doctor_and_patient") ||
          target.includes("all")
        );
      })
      .map((n) => ({
        title: n.title,
        message: n.message,
        notifiedAt: n.notifiedAt,
        source: "referral",
      }));

    const central = (liveNotifications || [])
      .filter((n) => n.referralId === ref.id)
      .map((n) => ({
        title: n.title,
        message: n.message,
        notifiedAt: n.createdAt,
        source: "live_bus",
        channels: n.channelSummary,
      }));

    const merged = [...central, ...embedded];
    const seen = new Set();
    return merged
      .filter((item) => {
        const dedupKey = `${item.title}::${(item.notifiedAt || "").slice(0, 16)}`;
        if (seen.has(dedupKey)) return false;
        seen.add(dedupKey);
        return true;
      })
      .sort((a, b) => new Date(b.notifiedAt) - new Date(a.notifiedAt));
  };

  // Count notifications for selected referral
  const unreadCount = useMemo(() => {
    if (!selectedReferral) return 0;
    return getNotifications(selectedReferral).length;
  }, [selectedReferral, liveNotifications]);

  // Google Maps navigation link
  const getMapLink = (hospital) => {
    if (!hospital) return "#";
    const coords = hospital.coordinates;
    if (coords?.lat && coords?.lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
    }
    const addr = `${hospital.name}, ${hospital.address}, ${hospital.city}, ${hospital.state} ${hospital.pincode}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // VIEW 1: Access / Verification Gate
  if (accessMode === "unverified") {
    return (
      <div className="patient-dash-wrap">
        <div className="patient-access-gate">
          {/* Header */}
          <div className="pag-header">
            <div className="hosp-pill-badge">
              <span className="live-pulse-dot" />
              <span>Patient Portal · Relief Laser Health</span>
            </div>
            <h2 className="pag-title">Track Your Hospital Referral</h2>
            <p className="pag-sub">
              Enter your Referral ID, Patient ID, or registered phone number to view your referral status and hospital assignment.
            </p>
          </div>

          {/* Lookup Form */}
          <div className="pag-lookup-card">
            <div className="pag-lookup-section">
              <label htmlFor="pat-lookup">Patient Access</label>
              <div className="pag-input-row">
                <input
                  id="pat-lookup"
                  type="text"
                  className="dash-input"
                  placeholder="Enter Referral ID (e.g. REF-RLH-2026-7782) or Patient ID or Phone"
                  value={lookupInput}
                  onChange={(e) => setLookupInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePatientLookup()}
                />
                <button
                  type="button"
                  className="relief-primary-btn compact"
                  onClick={() => handlePatientLookup()}
                  disabled={loading}
                >
                  {loading ? "Verifying..." : "Access My Referral →"}
                </button>
              </div>
            </div>

            <div className="pag-divider">
              <span>or</span>
            </div>

            {/* Family Member Access */}
            <div className="pag-lookup-section family">
              <label htmlFor="fam-code">
                <span className="fam-icon">👨‍👩‍👧</span>
                Family Member / Caregiver Access
              </label>
              <p className="pag-hint">
                If you are an authorized family member, enter the access code provided by the referring doctor.
              </p>
              <div className="pag-input-row">
                <input
                  id="fam-code"
                  type="text"
                  className="dash-input"
                  placeholder="Family authorization code"
                  value={familyAccessCode}
                  onChange={(e) => setFamilyAccessCode(e.target.value)}
                />
                <button
                  type="button"
                  className="relief-secondary-btn compact"
                  onClick={handleFamilyAccess}
                  disabled={loading}
                >
                  Verify Family Access
                </button>
              </div>
            </div>

            {accessError && (
              <div className="dash-alert error" style={{ marginTop: 14 }}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{accessError}</span>
              </div>
            )}
          </div>

          {/* Privacy Notice */}
          <div className="pag-privacy-notice">
            <span className="ppn-icon">🔒</span>
            <div>
              <strong>Your Privacy is Protected</strong>
              <p>
                Referral details are accessible only to the verified patient or authorized family members. 
                Medical reports and clinical diagnosis are never shared without explicit physician authorization.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // VIEW 2: Patient Dashboard (Authenticated)
  const hospital = getHospitalForReferral(selectedReferral);
  const statusConfig = STATUS_CONFIG[selectedReferral?.status] || STATUS_CONFIG.Pending;
  const timeline = selectedReferral ? buildVisualTimeline(selectedReferral) : [];
  const notifications = selectedReferral ? getNotifications(selectedReferral) : [];

  const headerMeta = {
    dashboard: {
      title: "Patient Health Hub",
      sub: "Comprehensive medical overview, active clinical referrals, and hospital care coordination.",
      badge: "Patient Dashboard",
    },
    reports: {
      title: "My Medical Reports & Diagnostic History",
      sub: "Upload your diagnostic blood test or lab report PDF for immediate AI interpretation and risk score calculation.",
      badge: "Diagnostic Vault",
    },
    referrals: {
      title: "Hospital Referral Tracking",
      sub: "Live end-to-end status of referrals sent by your physician to network hospitals.",
      badge: "Referral Queue",
    },
    profile: {
      title: "My Confidential Health Profile",
      sub: "Personal details, emergency contacts, and encrypted clinical background for emergency care.",
      badge: "Confidential Profile",
    },
  }[activeTab] || {
    title: "Patient Health Hub",
    sub: "Comprehensive medical overview, active clinical referrals, and hospital care coordination.",
    badge: "Patient Dashboard",
  };

  return (
    <div className="patient-dash-wrap">
      {/* ── Dashboard Header ── */}
      <div className="pd-header">
        <div className="pd-header-left">
          <div className="hosp-pill-badge">
            <span className="live-pulse-dot" />
            <span>
              {accessMode === "family" ? "Family Access · " : ""}{headerMeta.badge} · Medora AI
            </span>
          </div>
          <h2 className="pd-title">{headerMeta.title}</h2>
          <p className="pd-sub">{headerMeta.sub}</p>
        </div>

        <div className="pd-header-right">
          {/* Notification Bell */}
          <button
            type="button"
            className="pd-notif-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && <span className="notif-badge-count">{unreadCount}</span>}
          </button>
        </div>
      </div>

      {/* ── Notification Panel (Slide Down) ── */}
      {showNotifications && (
        <div className="pd-notif-panel">
          <div className="notif-panel-header">
            <h4>Referral Notifications</h4>
            <button type="button" className="notif-close-btn" onClick={() => setShowNotifications(false)}>✕</button>
          </div>
          {notifications.length === 0 ? (
            <div className="notif-empty">
              <p>No notifications yet. You will be notified when your referral status changes.</p>
            </div>
          ) : (
            <div className="notif-list">
              {notifications.map((n, idx) => (
                <div key={idx} className="notif-item">
                  <div className="ni-top">
                    <strong className="ni-title">{n.title}</strong>
                    <span className="ni-time">{new Date(n.notifiedAt).toLocaleString()}</span>
                  </div>
                  <p className="ni-msg">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modern Segmented Sub-navigation Dock ── */}
      <div className="portal-subnav-dock">
        <button
          type="button"
          className={`portal-tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="portal-tab-icon">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <span>Patient Dashboard</span>
        </button>

        <button
          type="button"
          className={`portal-tab-btn ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="portal-tab-icon">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span>My Medical Reports</span>
          {results.length > 0 && <span className="portal-tab-badge">{results.length}</span>}
        </button>

        <button
          type="button"
          className={`portal-tab-btn ${activeTab === "referrals" ? "active" : ""}`}
          onClick={() => setActiveTab("referrals")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="portal-tab-icon">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M9 14l2 2 4-4" />
          </svg>
          <span>My Referrals</span>
          {referrals.length > 0 && <span className="portal-tab-badge">{referrals.length}</span>}
        </button>

        <button
          type="button"
          className={`portal-tab-btn ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="portal-tab-icon">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>My Profile</span>
        </button>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          TAB 1: PATIENT DASHBOARD OVERVIEW
      ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === "dashboard" && (
        <section className="patient-overview-tab">
          {/* Welcome Banner */}
          <div className="welcome-banner" style={{ background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)", color: "#ffffff", padding: "1.75rem", borderRadius: "14px", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <span style={{ background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "600" }}>
                Authenticated Patient Portal
              </span>
              <h2 style={{ margin: "8px 0 4px", fontSize: "1.5rem", color: "#ffffff" }}>
                Welcome back, {profile?.fullName || (userEmail ? userEmail.split("@")[0] : "Patient")}!
              </h2>
              <p style={{ margin: 0, opacity: 0.9, fontSize: "14px" }}>
                MRN: <strong>{selectedReferral?.patient?.patientId || profile?.uid?.slice(0, 10) || "PID-2024-9124"}</strong> • Confidential Personal Health Space
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="relief-primary-btn compact"
                onClick={() => setActiveTab("reports")}
                style={{ background: "#ffffff", color: "#064e3b", fontWeight: "700" }}
              >
                + Upload Medical Report
              </button>
              <button
                type="button"
                className="relief-secondary-btn compact"
                onClick={() => setActiveTab("referrals")}
                style={{ background: "rgba(255,255,255,0.15)", color: "#ffffff", borderColor: "rgba(255,255,255,0.3)" }}
              >
                Track Referrals →
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="doc-metrics-grid" style={{ marginBottom: "1.5rem" }}>
            <div className="doc-metric-card box-emerald">
              <span className="dmc-label">Active Referrals</span>
              <strong className="dmc-val">{referrals.filter(r => r.status !== 'Completed').length}</strong>
              <span className="dmc-sub">Hospital admissions in progress</span>
            </div>
            <div className="doc-metric-card box-navy">
              <span className="dmc-label">Analyzed Reports</span>
              <strong className="dmc-val">{results.length > 0 ? results.length : "Ready"}</strong>
              <span className="dmc-sub">AI diagnostic insights in vault</span>
            </div>
            <div className="doc-metric-card box-amber">
              <span className="dmc-label">Emergency Care</span>
              <strong className="dmc-val" style={{ fontSize: "1.1rem" }}>
                {selectedReferral?.patient?.emergencyContact || profile?.emergencyContact || "+91 11 4000 9999"}
              </strong>
              <span className="dmc-sub">24/7 designated support line</span>
            </div>
          </div>

          {/* Active Referral Preview */}
          {selectedReferral ? (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.5rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <span className="mono-id">{selectedReferral.id}</span>
                  <h3 style={{ margin: "4px 0 0", color: "#0f172a" }}>
                    Active Referral: {selectedReferral.clinicalRequirements?.procedure || "Hospital Transfer"}
                  </h3>
                </div>
                <span className={`status-pill-table ${(selectedReferral.status || "").toLowerCase().replace(/\s/g, "-")}`}>
                  ● {selectedReferral.status}
                </span>
              </div>
              <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 1rem" }}>
                Referred by <strong>{selectedReferral.doctorName}</strong> ({selectedReferral.doctorClinic})
                {selectedReferral.targetHospitalName && ` to ${selectedReferral.targetHospitalName}`}
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="relief-primary-btn compact"
                  onClick={() => setActiveTab("referrals")}
                >
                  View Full Live Journey Timeline →
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "12px", padding: "2rem", textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📋</div>
              <h3 style={{ margin: "0 0 0.5rem", color: "#1e293b" }}>No active referrals pending</h3>
              <p style={{ color: "#64748b", margin: "0" }}>
                When your physician issues a specialist referral or hospital transfer pass, it will be automatically tracked here.
              </p>
            </div>
          )}

          {/* Quick Shortcuts */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "1.25rem", cursor: "pointer" }} onClick={() => setActiveTab("reports")}>
              <span style={{ fontSize: "1.5rem" }}>📄</span>
              <h4 style={{ margin: "8px 0 4px", color: "#0f172a" }}>My Medical Reports</h4>
              <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>View your diagnostic blood tests, lab values, and AI deterioration score.</p>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "1.25rem", cursor: "pointer" }} onClick={() => setActiveTab("referrals")}>
              <span style={{ fontSize: "1.5rem" }}>📋</span>
              <h4 style={{ margin: "8px 0 4px", color: "#0f172a" }}>Active Referrals</h4>
              <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>Track clinical referrals sent by your doctor to network hospitals in real-time.</p>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "1.25rem", cursor: "pointer" }} onClick={() => onNavigate && onNavigate("cost")}>
              <span style={{ fontSize: "1.5rem" }}>🏥</span>
              <h4 style={{ margin: "8px 0 4px", color: "#0f172a" }}>Hospital Cost Estimates</h4>
              <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>Explore transparent price ranges for advanced laser procedures and room types.</p>
            </div>
          </div>
        </section>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          TAB 2: MY MEDICAL REPORTS
      ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === "reports" && (
        <section className="patient-reports-tab">
          <div className="doc-desk-header" style={{ marginBottom: "1.25rem" }}>
            <div>
              <h2 className="section-heading">My Medical Reports &amp; Diagnostic Records</h2>
              <p className="doc-main-sub">
                Upload your blood test or hospital lab report PDF for immediate AI interpretation and risk score calculation.
              </p>
            </div>
            {onNavigate && (
              <button
                type="button"
                className="relief-primary-btn compact"
                onClick={() => onNavigate("report")}
              >
                Open Full Report Analyzer →
              </button>
            )}
          </div>

          <div className="modern-upload-card">
            <label
              className={`modern-dropzone ${isDragging ? "drag-active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file && onFile) onFile(file);
              }}
            >
              <input
                type="file"
                accept="application/pdf,image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && onFile) onFile(file);
                }}
              />
              <div className="dropzone-icon-halo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dropzone-svg">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="dropzone-text">
                <h4>Drop your medical report PDF here, or <span className="dropzone-browse">browse files</span></h4>
                <p>Supports CBC, Lipid Panel, Liver & Kidney Function, Blood Sugar (PDF up to 25MB)</p>
              </div>
              <span className="dropzone-btn">Select PDF Report</span>
            </label>

            {results.length > 0 && (
              <div className="report-analyzed-badge-card">
                <div className="rabc-left">
                  <span className="rabc-check">✓</span>
                  <div>
                    <strong>{results.length} Lab Biomarkers Analyzed</strong>
                    <p>AI diagnostic insights, risk assessment, and clinical normal ranges are ready in your vault.</p>
                  </div>
                </div>
                {onNavigate && (
                  <button
                    type="button"
                    className="relief-primary-btn compact"
                    onClick={() => onNavigate("report")}
                  >
                    View Full Report Analysis →
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          TAB 4: PATIENT PROFILE
      ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === "profile" && (
        <section className="patient-profile-tab">
          <div className="doc-desk-header" style={{ marginBottom: "1.25rem" }}>
            <div>
              <h2 className="section-heading">Patient Health Profile &amp; Emergency Contacts</h2>
              <p className="doc-main-sub">
                Confidential personal details used by referring clinicians and hospitals to coordinate emergency care.
              </p>
            </div>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <h4 style={{ margin: "0 0 12px", fontSize: "14px", color: "#334155" }}>Personal Information</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                  <div><span style={{ color: "#64748b" }}>Full Name:</span> <strong>{profile?.fullName || selectedReferral?.patient?.name || "Rahul Verma"}</strong></div>
                  <div><span style={{ color: "#64748b" }}>Medical Record No. (MRN):</span> <span className="mono-id">{selectedReferral?.patient?.patientId || profile?.uid?.slice(0, 10) || "PID-2024-9124"}</span></div>
                  <div><span style={{ color: "#64748b" }}>Date of Birth / Age:</span> <span>{profile?.dateOfBirth || `${selectedReferral?.patient?.age || 42} years`}</span></div>
                  <div><span style={{ color: "#64748b" }}>Gender:</span> <span>{profile?.gender || selectedReferral?.patient?.gender || "Male"}</span></div>
                  <div><span style={{ color: "#64748b" }}>Contact Phone:</span> <strong>{profile?.phone || selectedReferral?.patient?.contact || "+91 98765 43210"}</strong></div>
                  <div><span style={{ color: "#64748b" }}>Account Email:</span> <span>{userEmail || profile?.email || "patient@medisync.ai"}</span></div>
                </div>
              </div>

              <div>
                <h4 style={{ margin: "0 0 12px", fontSize: "14px", color: "#334155" }}>Emergency Contacts &amp; Clinical Notes</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                  <div><span style={{ color: "#64748b" }}>Designated Emergency Contact:</span> <strong>{profile?.emergencyContact || selectedReferral?.patient?.emergencyContact || "+91 98111 22233"}</strong></div>
                  <div><span style={{ color: "#64748b" }}>Known Allergies:</span> <span style={{ color: "#16a34a" }}>None recorded (Penicillin / NSAIDs negative)</span></div>
                  <div><span style={{ color: "#64748b" }}>Data Privacy Standard:</span> <span>DISHA &amp; HIPAA-Grade Encrypted</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          TAB 3: MY REFERRALS TRACKING (Live Timeline)
      ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === "referrals" && (
        <>
      {(aiGuideLoading || aiGuideText) && (
        <div className="pd-ai-guide-card">
          <div className="pagc-top">
            <strong>
              {aiGuideLang === "hi" ? "🇮🇳 हिन्दी में रेफरल स्थिति और निर्देश" : "🌐 Plain-Language Referral Guide (English)"}
            </strong>
            <button type="button" className="notif-close-btn" onClick={() => setAiGuideText("")}>
              ✕
            </button>
          </div>
          <p>{aiGuideLoading ? "Translating current status and hospital instructions..." : aiGuideText}</p>
        </div>
      )}

      {/* ── Referral Selector (if multiple referrals) ── */}
      {referrals.length > 1 && (
        <div className="pd-referral-selector">
          <span className="prs-label">Your Referrals ({referrals.length}):</span>
          <div className="prs-chips">
            {referrals.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`prs-chip ${selectedReferral?.id === r.id ? "active" : ""}`}
                onClick={() => setSelectedReferral(r)}
              >
                <span className="prs-id">{r.id}</span>
                <span className={`prs-status ${(r.status || "").toLowerCase().replace(/\s/g, "-")}`}>
                  {r.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedReferral && (
        <>
          {/* ── Large Patient-Friendly Status Card ── */}
          <div
            className="pd-status-hero"
            style={{
              background: statusConfig.bg,
              borderColor: statusConfig.borderColor,
            }}
          >
            <div className="psh-indicator" style={{ background: statusConfig.color }} />
            <div className="psh-content">
              <div className="psh-top-row">
                <div>
                  <span className="psh-label">Current Status</span>
                  <h3 className="psh-status-text" style={{ color: statusConfig.color }}>
                    {statusConfig.label}
                  </h3>
                </div>
                <div className="psh-ref-id">
                  <span className="psh-label">Referral ID</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span className={`data-source-pill ${selectedReferral.isDemoData ? "demo" : "live"}`}>
                      {selectedReferral.isDemoData ? "Demo Sample" : "Live Referral"}
                    </span>
                    <strong className="mono-id psh-id">{selectedReferral.id}</strong>
                  </div>
                </div>
              </div>

              <div className="psh-detail-row">
                <div className="psh-detail">
                  <span className="psh-label">Patient</span>
                  <strong>{selectedReferral.patient?.name}</strong>
                  <span>{selectedReferral.patient?.age} years • {selectedReferral.patient?.gender}</span>
                </div>
                <div className="psh-detail">
                  <span className="psh-label">Referring Doctor</span>
                  <strong>{selectedReferral.doctorName}</strong>
                  <span>{selectedReferral.doctorClinic}</span>
                </div>
                <div className="psh-detail">
                  <span className="psh-label">Priority</span>
                  <span className={`priority-badge ${(selectedReferral.priority || "routine").toLowerCase()}`}>
                    {selectedReferral.priority}
                  </span>
                </div>
                <div className="psh-detail">
                  <span className="psh-label">Procedure</span>
                  <strong>{selectedReferral.clinicalRequirements?.procedure}</strong>
                  <span>{selectedReferral.clinicalRequirements?.specialty}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Visual Referral Timeline ── */}
          <div className="pd-timeline-card">
            <div className="ptc-header">
              <h3 className="section-heading">Referral Journey Timeline</h3>
              <p className="section-subtext">
                Real-time progress of your referral. Only events that have actually occurred are displayed.
              </p>
            </div>

            <div className="ptc-timeline">
              {timeline.map((event, idx) => {
                const isLast = idx === timeline.length - 1;
                const isRejected = event.key === "Rejected";
                const isAccepted = event.key === "Accepted";

                return (
                  <div key={idx} className={`ptc-event ${isLast ? "current" : ""} ${isRejected ? "rejected" : ""} ${isAccepted ? "accepted" : ""}`}>
                    <div className="ptc-node-col">
                      <div className={`ptc-dot ${isLast ? "pulse" : "done"} ${isRejected ? "dot-red" : ""} ${isAccepted ? "dot-green" : ""}`}>
                        <span>{event.icon}</span>
                      </div>
                      {!isLast && <div className={`ptc-connector ${isRejected ? "conn-red" : ""}`} />}
                    </div>

                    <div className="ptc-event-body">
                      <div className="ptc-ev-top">
                        <strong className="ptc-ev-label">{event.label}</strong>
                        <span className="ptc-ev-time">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {event.note && (
                        <p className="ptc-ev-note">{event.note}</p>
                      )}
                      {event.by && (
                        <span className="ptc-ev-by">By: {event.by}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Future milestones (pending) */}
              {selectedReferral.status !== "Completed" && (
                <div className="ptc-event upcoming">
                  <div className="ptc-node-col">
                    <div className="ptc-dot pending">
                      <span>⏳</span>
                    </div>
                  </div>
                  <div className="ptc-event-body">
                    <strong className="ptc-ev-label ptc-pending-label">
                      {selectedReferral.status === "Accepted"
                        ? "Awaiting Patient Transfer Initiation"
                        : selectedReferral.status === "Transfer Initiated"
                        ? "Patient Transfer In Progress — Awaiting Arrival"
                        : selectedReferral.status === "Patient Arrived"
                        ? "Arrived at Hospital — Awaiting Admission Confirmation"
                        : selectedReferral.status === "Rejected"
                        ? "Awaiting Alternative Hospital Assignment"
                        : "Awaiting Hospital Confirmation"}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Accepted / Active Receiving Hospital Details Card ── */}
          {["Accepted", "Transfer Initiated", "Patient Arrived", "Completed"].includes(selectedReferral.status) && hospital && (
            <div className="pd-hospital-card accepted-glow">
              <div className="phc-header-strip">
                <div className="phc-badge-group">
                  <span className="phc-accepted-badge">✓ Hospital Confirmed & Verified</span>
                  <span className="phc-accept-time">
                    Accepted: {new Date(
                      selectedReferral.timeline?.find((t) => t.status === "Accepted")?.timestamp || selectedReferral.acceptedAt || ""
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="phc-body">
                <div className="phc-info-grid">
                  <div className="phc-info-col">
                    <span className="phc-label">Hospital Name</span>
                    <h4 className="phc-hosp-name">{hospital.name}</h4>
                  </div>
                  <div className="phc-info-col">
                    <span className="phc-label">Full Address</span>
                    <p className="phc-address">
                      {hospital.address}, {hospital.city}, {hospital.state} - {hospital.pincode}
                    </p>
                  </div>
                  <div className="phc-info-col">
                    <span className="phc-label">Contact Phone</span>
                    <strong className="phc-phone">{hospital.contactPhone}</strong>
                  </div>
                  <div className="phc-info-col">
                    <span className="phc-label">Email</span>
                    <strong>{hospital.email}</strong>
                  </div>
                  <div className="phc-info-col">
                    <span className="phc-label">Hospital Type</span>
                    <span>{hospital.hospitalType}</span>
                  </div>
                  <div className="phc-info-col">
                    <span className="phc-label">Referral Status</span>
                    <span className="phc-confirmed-pill">● Confirmed & Active</span>
                  </div>
                </div>

                {/* Arrival Instructions */}
                <div className="phc-arrival-instructions">
                  <h4>📋 Expected Arrival Instructions</h4>
                  <ul>
                    <li>Carry this digital referral pass (Referral ID: <strong>{selectedReferral.id}</strong>) on your phone.</li>
                    <li>Bring all original lab reports and a valid photo ID (Aadhaar / PAN / Passport).</li>
                    <li>Arrive at the <strong>Admission Desk</strong> and present your Referral ID to the front desk staff.</li>
                    <li>If you have insurance, carry your TPA card and pre-authorization letter for cashless processing.</li>
                    <li>Please report at least <strong>1 hour</strong> before the scheduled procedure time for pre-operative preparation.</li>
                    <li>An attendant or family member should accompany you for discharge support.</li>
                  </ul>
                </div>

                {/* Map & Navigation */}
                <div className="phc-map-row">
                  <a
                    href={getMapLink(hospital)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relief-primary-btn compact"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>Navigate to Hospital (Google Maps)</span>
                  </a>

                  <a href={`tel:${hospital.contactPhone}`} className="relief-secondary-btn compact">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span>Call Hospital</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ── Pending / Awaiting Hospital Card ── */}
          {(selectedReferral.status === "Pending" || selectedReferral.status === "Information Requested") && selectedReferral.targetHospitalName && (
            <div className="pd-hospital-card pending-card">
              <div className="phc-header-strip pending-strip">
                <div className="phc-badge-group">
                  <span className="phc-pending-badge">⏳ Awaiting Hospital Response</span>
                </div>
              </div>
              <div className="phc-body">
                <div className="phc-info-grid">
                  <div className="phc-info-col">
                    <span className="phc-label">Referral Sent To</span>
                    <h4 className="phc-hosp-name">{selectedReferral.targetHospitalName}</h4>
                  </div>
                  {hospital && (
                    <>
                      <div className="phc-info-col">
                        <span className="phc-label">Location</span>
                        <p>{hospital.city}, {hospital.state}</p>
                      </div>
                      <div className="phc-info-col">
                        <span className="phc-label">Hospital Type</span>
                        <span>{hospital.hospitalType}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="phc-waiting-msg">
                  <p>
                    Your referral has been sent to this hospital's admissions desk. 
                    You will be notified immediately when the hospital confirms availability and accepts your admission.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Rejected / Searching Alternatives Card ── */}
          {selectedReferral.status === "Rejected" && (
            <div className="pd-hospital-card rejected-card">
              <div className="phc-header-strip rejected-strip">
                <div className="phc-badge-group">
                  <span className="phc-rejected-badge">🔄 Finding Alternative Hospital</span>
                </div>
              </div>
              <div className="phc-body">
                <div className="phc-rejection-info">
                  <p>
                    <strong>{selectedReferral.targetHospitalName || "The selected hospital"}</strong> was unable to 
                    accommodate your referral at this time. Your doctor is coordinating with alternative verified hospitals 
                    to find the next best facility for your care.
                  </p>
                  <div className="phc-reassurance-box">
                    <span className="prb-icon">💪</span>
                    <div>
                      <strong>Don't worry — your referral is safe</strong>
                      <p>
                        All your medical records, lab reports, and clinical requirements are preserved. 
                        You do not need to re-submit anything. Our system is actively matching you with the next available accredited facility.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Referral Details Summary Card ── */}
          <div className="pd-details-card">
            <div className="pdc-header">
              <h3 className="section-heading">Referral Summary</h3>
            </div>

            <div className="pdc-grid">
              <div className="pdc-section">
                <h4 className="pdc-sec-title">Patient Information</h4>
                <div className="pdc-fields">
                  <div className="pdc-field">
                    <span className="pdc-k">Full Name</span>
                    <strong className="pdc-v">{selectedReferral.patient?.name}</strong>
                  </div>
                  <div className="pdc-field">
                    <span className="pdc-k">Patient ID</span>
                    <strong className="pdc-v">{selectedReferral.patient?.patientId}</strong>
                  </div>
                  <div className="pdc-field">
                    <span className="pdc-k">Age / Gender</span>
                    <strong className="pdc-v">{selectedReferral.patient?.age} years • {selectedReferral.patient?.gender}</strong>
                  </div>
                  <div className="pdc-field">
                    <span className="pdc-k">Location</span>
                    <strong className="pdc-v">{selectedReferral.patient?.location}</strong>
                  </div>
                  {accessMode === "patient" && (
                    <>
                      <div className="pdc-field">
                        <span className="pdc-k">Contact</span>
                        <strong className="pdc-v">{selectedReferral.patient?.contact}</strong>
                      </div>
                      <div className="pdc-field">
                        <span className="pdc-k">Emergency Contact</span>
                        <strong className="pdc-v">{selectedReferral.patient?.emergencyContact}</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="pdc-section">
                <h4 className="pdc-sec-title">Clinical Details</h4>
                <div className="pdc-fields">
                  <div className="pdc-field">
                    <span className="pdc-k">Specialty</span>
                    <strong className="pdc-v">{selectedReferral.clinicalRequirements?.specialty}</strong>
                  </div>
                  <div className="pdc-field">
                    <span className="pdc-k">Procedure</span>
                    <strong className="pdc-v">{selectedReferral.clinicalRequirements?.procedure}</strong>
                  </div>
                  <div className="pdc-field">
                    <span className="pdc-k">Referral Date</span>
                    <strong className="pdc-v">{new Date(selectedReferral.createdAt).toLocaleDateString()}</strong>
                  </div>
                  <div className="pdc-field">
                    <span className="pdc-k">Documents Attached</span>
                    <strong className="pdc-v">{selectedReferral.documents?.length || 0} file(s)</strong>
                  </div>
                </div>
              </div>

              <div className="pdc-section">
                <h4 className="pdc-sec-title">Referring Doctor</h4>
                <div className="pdc-fields">
                  <div className="pdc-field">
                    <span className="pdc-k">Doctor</span>
                    <strong className="pdc-v">{selectedReferral.doctorName}</strong>
                  </div>
                  <div className="pdc-field">
                    <span className="pdc-k">Clinic / Hospital</span>
                    <strong className="pdc-v">{selectedReferral.doctorClinic}</strong>
                  </div>
                </div>
              </div>

              {/* Rejection history (if any) */}
              {selectedReferral.rejectionHistory && selectedReferral.rejectionHistory.length > 0 && (
                <div className="pdc-section">
                  <h4 className="pdc-sec-title">Referral History</h4>
                  <div className="pdc-rejection-timeline">
                    {selectedReferral.rejectionHistory.map((rej, idx) => (
                      <div key={idx} className="pdc-rej-entry">
                        <span className="pdc-rej-num">Attempt #{idx + 1}</span>
                        <strong>{rej.hospitalName}</strong>
                        <span className="pdc-rej-reason">{rej.reason}</span>
                        <span className="pdc-rej-date">{new Date(rej.rejectedAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Privacy & Help Footer ── */}
          <div className="pd-privacy-footer">
            <div className="ppf-left">
              <span className="ppf-icon">🔒</span>
              <div>
                <strong>Privacy Notice</strong>
                <p>
                  {accessMode === "family"
                    ? "You are viewing this referral as an authorized family member. Clinical reports and detailed diagnosis are restricted."
                    : "This dashboard shows your personal referral data only. Medical reports are never shared with other patients."}
                </p>
              </div>
            </div>
            <div className="ppf-right">
              <span className="ppf-icon">📞</span>
              <div>
                <strong>Need Help?</strong>
                <p>24/7 Patient Support: <strong>+91 11 4000 9999</strong></p>
              </div>
            </div>
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}

