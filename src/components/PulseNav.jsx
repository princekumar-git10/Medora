import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

export default function PulseNav({ activePage, onNavigate, userEmail, onLogout, resultsCount, riskScore }) {
  const { t, lang, setLang, languages } = useLanguage();
  const { role, switchDemoRole, isDoctor, isHospital, isPatient, isAdmin } = useAuth();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  // Dynamic pages array based strictly on authenticated role
  let pages = [];

  if (isPatient) {
    // 👤 Patient Portal Pages (Doctor & Hospital portals strictly omitted)
    pages = [
      {
        id: "home",
        label: t("nav.medsync") || "Home",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 16.1l-4.8 2.5.9-5.3-3.8-3.7 5.3-.8z" />
          </svg>
        ),
      },
      {
        id: "patient_dashboard",
        label: "Patient Dashboard",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
        badge: "Portal",
        badgeType: "ok",
      },
      {
        id: "patient_referrals",
        label: "My Referrals",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        ),
      },
      {
        id: "report",
        label: "My Medical Reports",
        icon: (
          <svg viewBox="0 0 20 20" fill="currentColor" className="nav-svg">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
          </svg>
        ),
        badge: resultsCount ? `${resultsCount}` : null,
      },
      {
        id: "cost",
        label: "Hospital Costs",
        icon: (
          <svg viewBox="0 0 20 20" fill="currentColor" className="nav-svg">
            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
          </svg>
        ),
      },
    ];
  } else if (isDoctor) {
    // 🩺 Doctor Portal Pages (Hospital management strictly omitted)
    pages = [
      {
        id: "doctor_dashboard",
        label: "Doctor Portal",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M4.5 12.5l3.5-3.5 4 4 7.5-7.5" />
            <path d="M14 5.5h5.5V11" />
            <path d="M4 20h16" />
          </svg>
        ),
        badge: "Verified",
        badgeType: "ok",
      },
      {
        id: "doctor_create",
        label: "Create Referral",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M12 5v14M5 12h14" />
          </svg>
        ),
      },
      {
        id: "doctor_patients",
        label: "My Patients",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
      {
        id: "doctor_referrals",
        label: "Referrals Queue",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        ),
      },
      {
        id: "report",
        label: "Diagnostic AI",
        icon: (
          <svg viewBox="0 0 20 20" fill="currentColor" className="nav-svg">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
          </svg>
        ),
        badge: resultsCount ? `${resultsCount}` : null,
      },
      {
        id: "relief",
        label: "Relief Laser Network",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
            <path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
            <path d="M10 9h4M12 7v4" />
          </svg>
        ),
      },
      {
        id: "home",
        label: "Home",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 16.1l-4.8 2.5.9-5.3-3.8-3.7 5.3-.8z" />
          </svg>
        ),
      },
    ];
  } else if (isHospital) {
    // 🏥 Hospital Portal Pages (Doctor referral creation strictly omitted)
    pages = [
      {
        id: "hospital_dashboard",
        label: "Hospital Portal",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
            <path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
            <path d="M10 9h4M12 7v4" />
          </svg>
        ),
        badge: "Desk",
        badgeType: "ok",
      },
      {
        id: "hospital_incoming",
        label: "Incoming Referrals",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        ),
        badge: "Triage",
        badgeType: "warn",
      },
      {
        id: "hospital_capacity",
        label: "Live Bed Capacity",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h4M6 12h4M6 16h4M14 8h4M14 12h4M14 16h4" />
          </svg>
        ),
      },
      {
        id: "hospital_verify",
        label: "Doctor Verification",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
      {
        id: "relief",
        label: "Network Overview",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <circle cx="12" cy="12" r="9" />
            <path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
          </svg>
        ),
      },
      {
        id: "home",
        label: "Home",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 16.1l-4.8 2.5.9-5.3-3.8-3.7 5.3-.8z" />
          </svg>
        ),
      },
    ];
  } else if (isAdmin || role === "admin") {
    // 🛡️ Super Admin Pages
    pages = [
      {
        id: "admin_dashboard",
        label: "Super Admin",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
        badge: "Admin",
        badgeType: "warn",
      },
      {
        id: "admin_doctors",
        label: "Doctor Approvals",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <polyline points="17 11 19 13 23 9" />
          </svg>
        ),
      },
      {
        id: "admin_hospitals",
        label: "Hospital Accreditations",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
            <path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
            <path d="M10 9h4M12 7v4" />
          </svg>
        ),
      },
      {
        id: "admin_referrals",
        label: "Global Referrals",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        ),
      },
      {
        id: "relief",
        label: "Relief Laser Network",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <circle cx="12" cy="12" r="9" />
            <path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
          </svg>
        ),
      },
      {
        id: "home",
        label: "Home",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 16.1l-4.8 2.5.9-5.3-3.8-3.7 5.3-.8z" />
          </svg>
        ),
      },
    ];
  }

  /* Exit / logout SVG icon */
  const ExitIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" width="17" height="17" aria-hidden="true">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );

  const roleLabel =
    role === "doctor"
      ? "🩺 Doctor"
      : role === "hospital"
      ? "🏥 Hospital"
      : role === "admin"
      ? "🛡️ Super Admin"
      : "👤 Patient";

  return (
    <nav className="pulse-nav" role="navigation" aria-label={t("nav.mainNav")}>
      {/* ── Brand Logo: Compact ── */}
      <div className="pn-brand" onClick={() => onNavigate("home")}>
        <div className="pn-logo-mark">
          <svg viewBox="0 0 32 32" fill="none" className="pn-logo-svg" aria-hidden="true">
            <rect width="32" height="32" rx="9" fill="url(#logoGrad)" />
            <path d="M16 6v6m0 8v6M6 16h6m8 0h6" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M10 16h3.5l1.8-4 2 8 1.7-4H22" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="22" cy="16" r="2" fill="#10b981" />
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0f5c63" />
                <stop offset="1" stopColor="#14b8a6" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="pn-brand-text-wrap">
          <div className="pn-brand-title">
            <span className="brand-med">Med</span>
            <span className="brand-report">ora</span>
            <span className="brand-ai-badge">AI</span>
          </div>
        </div>
      </div>

      {/* ── Scrollable Tab Strip ── */}
      <div className="pn-center">
        <div className="pn-tabs-scroll-track">
          <div className="pn-tabs">
            {pages.map((p) => {
              const isActive = activePage === p.id;
              return (
                <button
                  key={p.id}
                  className={`pn-tab ${isActive ? "active" : ""}`}
                  onClick={() => onNavigate(p.id)}
                  aria-current={isActive ? "page" : undefined}
                  title={p.label}
                >
                  <span className="pn-tab-icon">{p.icon}</span>
                  <span className="pn-tab-text">{p.label}</span>
                  {p.badge && (
                    <span className={`pn-tab-badge ${p.badgeType || ""}`}>
                      {p.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Role Badge + Language Pill + User Avatar + Exit ── */}
      <div className="pn-user-portal">
        {/* Active Role Indicator Badge */}
        <div
          className={`pn-role-badge role-${role}`}
          onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
          title="Click to switch role (Demo Evaluator Mode)"
          style={{ cursor: "pointer" }}
        >
          <span>{roleLabel}</span>
          <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>▾</span>
        </div>

        {/* Demo Switcher Dropdown */}
        {showRoleSwitcher && (
          <div style={{
            position: "absolute",
            top: "50px",
            right: "120px",
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "12px",
            padding: "8px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
            zIndex: 1500,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            minWidth: "160px"
          }}>
            <small style={{ color: "#64748b", fontWeight: "700", padding: "4px 8px" }}>
              Switch Demo Role:
            </small>
            <button
              type="button"
              className="portal-tab-btn"
              onClick={() => { switchDemoRole("patient"); setShowRoleSwitcher(false); onNavigate("patient_dashboard"); }}
            >
              👤 Patient Portal
            </button>
            <button
              type="button"
              className="portal-tab-btn"
              onClick={() => { switchDemoRole("doctor"); setShowRoleSwitcher(false); onNavigate("doctor_dashboard"); }}
            >
              🩺 Doctor Portal
            </button>
            <button
              type="button"
              className="portal-tab-btn"
              onClick={() => { switchDemoRole("hospital"); setShowRoleSwitcher(false); onNavigate("hospital_dashboard"); }}
            >
              🏥 Hospital Portal
            </button>
            <button
              type="button"
              className="portal-tab-btn"
              onClick={() => { switchDemoRole("admin"); setShowRoleSwitcher(false); onNavigate("admin_dashboard"); }}
            >
              🛡️ Super Admin
            </button>
          </div>
        )}

        {/* Language Selector */}
        <div className="pn-lang-switch-wrap" title={t("nav.selectLang")}>
          <span className="lang-globe-icon" aria-hidden="true">🌐</span>
          <select
            className="pn-lang-select"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label={t("nav.selectLang")}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native}
              </option>
            ))}
          </select>
        </div>

        {/* User Avatar */}
        <div className="pn-user-info" title={userEmail} aria-label={t("nav.signedInAs", { email: userEmail })}>
          <div className="pn-avatar-wrap">
            <span className="pn-avatar">{userEmail?.[0]?.toUpperCase() || "U"}</span>
            <span className="pn-status-pip" />
          </div>
        </div>

        {/* Logout */}
        <button
          className="pn-logout-btn"
          onClick={onLogout}
          title={t("nav.signOut")}
          aria-label={t("nav.signOut")}
        >
          <ExitIcon />
        </button>
      </div>

      {/* Ambient ECG Pulse Beam */}
      <div className="pn-ambient-pulse" aria-hidden="true">
        <svg viewBox="0 0 800 12" preserveAspectRatio="none" className="ambient-ecg-svg">
          <path
            d="M 0,6 L 250,6 L 260,2 L 268,10 L 276,0 L 284,11 L 292,6 L 500,6 L 510,2 L 518,10 L 526,0 L 534,11 L 542,6 L 800,6"
            fill="none"
            stroke="url(#ambientPulseGrad)"
            strokeWidth="1.8"
            className="ambient-path"
          />
          <defs>
            <linearGradient id="ambientPulseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0f5c63" stopOpacity="0.05" />
              <stop offset="50%" stopColor="#10b981" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#0f5c63" stopOpacity="0.05" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </nav>
  );
}
