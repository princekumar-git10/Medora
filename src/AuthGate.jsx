import { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import Splash from "./components/Splash";

export default function AuthGate({ children }) {
  const { user, profile, profileLoading, logout, switchDemoRole } = useAuth();
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [forceReady, setForceReady] = useState(false);

  // Keep splash screen visible briefly for clean presentation (350ms), with hard 1600ms safety timeout
  useEffect(() => {
    const minTimer = setTimeout(() => setMinTimePassed(true), 350);
    const hardTimer = setTimeout(() => setForceReady(true), 1600);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(hardTimer);
    };
  }, []);

  const showSplash = (user === undefined || profileLoading || !minTimePassed) && !forceReady;

  if (showSplash) {
    return <Splash leaving={false} onSkip={() => setForceReady(true)} />;
  }

  if (!user || !profile) {
    return <Login />;
  }

  // Account Status: SUSPENDED
  if (profile?.accountStatus === "SUSPENDED") {
    return (
      <main className="authPage">
        <div className="authCard" style={{ textAlign: "center", maxWidth: "480px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🚫</div>
          <h1 style={{ color: "#b91c1c", fontSize: "1.4rem" }}>Access Restricted</h1>
          <p className="tag" style={{ color: "#7f1d1d", margin: "12px 0 20px" }}>
            This account ({profile.email}) has been suspended by the Medora Security Directorate due to an administrative review or credential mismatch.
          </p>
          <div style={{ background: "#fef2f2", border: "1px solid #fecdd3", padding: "12px", borderRadius: "8px", fontSize: "0.84rem", color: "#991b1b", marginBottom: "20px" }}>
            For appeals or credential reactivation, please contact <strong>compliance@medora.ai</strong> with your Medical Council / NABH license documents.
          </div>
          <button type="button" className="authPrimary" onClick={logout}>
            Sign Out
          </button>
        </div>
      </main>
    );
  }

  // Account Status: PENDING_VERIFICATION (For Doctor or Hospital)
  if (profile?.accountStatus === "PENDING_VERIFICATION") {
    const isDoc = profile.role === "doctor";
    return (
      <main className="authPage">
        <div className="authCard" style={{ textAlign: "center", maxWidth: "520px" }}>
          <div style={{ fontSize: "2.8rem", marginBottom: "10px" }}>⏳</div>
          <h1 style={{ color: "#0f5c63", fontSize: "1.35rem" }}>
            {isDoc ? "Doctor Credential Verification Underway" : "Hospital Accreditation Verification Underway"}
          </h1>
          <p className="tag" style={{ margin: "10px 0 16px" }}>
            Welcome, <strong>{profile.fullName || profile.email}</strong>.
          </p>

          <div style={{ background: "#f0fdfa", border: "1.5px solid #99f6e4", padding: "16px", borderRadius: "12px", textAlign: "left", fontSize: "0.85rem", lineHeight: "1.55", color: "#134e4a", marginBottom: "20px" }}>
            <div style={{ fontWeight: "700", marginBottom: "6px", color: "#0f5c63" }}>
              📋 Submitted Details for Review:
            </div>
            {isDoc ? (
              <>
                <div>• <strong>Medical Reg No:</strong> {profile.medicalRegNumber || "Under Review"}</div>
                <div>• <strong>Medical Council:</strong> {profile.medicalCouncil || "State Council"}</div>
                <div>• <strong>Specialization:</strong> {profile.specialization || "General Medicine"}</div>
                <div>• <strong>Affiliated Clinic:</strong> {profile.affiliation || "Private Practice"}</div>
              </>
            ) : (
              <>
                <div>• <strong>Hospital License:</strong> {profile.registrationNumber || "Under Review"}</div>
                <div>• <strong>Type:</strong> {profile.hospitalType || "Multi-Speciality"}</div>
                <div>• <strong>Address:</strong> {profile.city}, {profile.state} ({profile.pinCode})</div>
              </>
            )}
            <hr style={{ margin: "10px 0", border: 0, borderTop: "1px solid #ccfbf1" }} />
            <small style={{ color: "#0f766e", display: "block" }}>
              🛡️ <strong>Statutory Compliance Guard:</strong> In accordance with Indian healthcare regulations, unverified clinical accounts cannot dispatch emergency referrals or authorize hospital bed holds until certified by an authorized administrator.
            </small>
          </div>

          {/* Hackathon Evaluation Fast-Pass */}
          <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "10px", padding: "12px", marginBottom: "18px" }}>
            <div style={{ fontSize: "0.78rem", fontWeight: "700", color: "#475569", marginBottom: "6px" }}>
              ⚡ Evaluator / Buildathon Quick-Action:
            </div>
            <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0 0 8px" }}>
              To test the full referral workflow immediately without waiting for administrator review, click below:
            </p>
            <button
              type="button"
              className="demo-pill-btn"
              style={{ background: "#0f5c63", color: "#fff", padding: "6px 14px", border: 0 }}
              onClick={() => switchDemoRole(profile.role)}
            >
              ✓ Grant Instant Verification (Demo Pass)
            </button>
          </div>

          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button type="button" className="authSecondary" onClick={logout} style={{ padding: "8px 18px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff", cursor: "pointer" }}>
              Sign Out
            </button>
          </div>
        </div>
      </main>
    );
  }

  return children;
}
