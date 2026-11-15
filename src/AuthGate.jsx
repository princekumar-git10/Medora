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

  return children;
}
