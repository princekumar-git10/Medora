import { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";

export default function Splash({ leaving, onSkip }) {
  const { t } = useLanguage();
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSkip(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`splash ${leaving ? "leaving" : ""}`} role="status" aria-label={t("common.loading")}>
      <svg className="pulse" viewBox="0 0 120 40" aria-hidden="true">
        <polyline points="0,20 30,20 40,20 46,6 54,34 62,12 68,20 120,20" />
      </svg>
      <div className="title">Medora AI</div>
      <p>{t("splash.subtitle") || "Understand your lab report in plain language"}</p>
      <div className="bar"><span /></div>

      {showSkip && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          style={{
            marginTop: "24px",
            background: "rgba(255, 255, 255, 0.18)",
            border: "1px solid rgba(255, 255, 255, 0.45)",
            color: "#ffffff",
            padding: "8px 20px",
            borderRadius: "999px",
            fontSize: "0.85rem",
            fontWeight: "700",
            cursor: "pointer",
            transition: "all 0.2s ease",
            backdropFilter: "blur(6px)",
          }}
        >
          Enter Portal →
        </button>
      )}
    </div>
  );
}
