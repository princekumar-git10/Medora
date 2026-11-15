import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

export default function ResultCard({ r, result }) {
  const item = r || result;
  if (!item || !item.test) return null;

  const [open, setOpen] = useState(false);
  const { test, value, low, high, status, needsAttention } = item;
  const { t, tStatus, tTestName, lang, languages } = useLanguage();

  function speak(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const reason = status === "low" ? (item.explanation || test.whyLow) : status === "high" ? (item.explanation || test.whyHigh) : "";
    const localizedName = tTestName(test.name);
    const localizedStatus = tStatus(status);
    const text = `${localizedName}: ${value} ${test.unit}. ${t("card.normalRange", { low, high })}. ${localizedStatus}. ${item.what || test.what || ""} ${reason || ""}`;
    const u = new SpeechSynthesisUtterance(text);
    const voiceLang = languages.find((l) => l.code === lang)?.voiceLang || "en-IN";
    u.lang = voiceLang;
    window.speechSynthesis.speak(u);
  }

  const whatText = item.what || test.what;
  const whyLowText = status === "low" ? (item.explanation || test.whyLow) : "";
  const whyHighText = status === "high" ? (item.explanation || test.whyHigh) : "";
  const questions = (item.questions && item.questions.length > 0) ? item.questions : (test.questions || []);

  return (
    <div className={`card ${status} ${needsAttention ? "urgent" : ""}`}>
      <div 
        className="card-header-row" 
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen(!open); }}
      >
        {/* Left: Test Name & Normal Range */}
        <div className="card-col-info">
          <div className="card-test-name">{tTestName(test.name)}</div>
          <div className="card-test-range">{t("card.normalRange", { low, high })}</div>
        </div>

        {/* Center / Right: Patient Measured Value */}
        <div className="card-col-value">
          <span className="card-value-num">{value}</span>
          <span className="card-value-unit">{test.unit}</span>
        </div>

        {/* Far Right: Status Pill & Chevron */}
        <div className="card-col-status">
          <span className={`chip ${status}`}>
            {tStatus(status).toUpperCase()}
          </span>
          <span className={`card-chevron ${open ? "open" : ""}`} aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </span>
        </div>
      </div>

      {/* Priority Review Alert Banner (when test is significantly outside range) */}
      {needsAttention && (
        <div className="card-urgent-strip">
          <span className="cus-icon">⚠️</span>
          <span className="cus-text">{t("card.alertOutside")}</span>
        </div>
      )}

      {/* Expandable Clinical Details */}
      {open && (
        <div className="details">
          <div className="details-toolbar">
            <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>
              {status === "normal" 
                ? "✓ Within standard physiological limits" 
                : `⚠️ ${status.toUpperCase()} (${item.deviation ? item.deviation + "% deviation" : "Requires physician review"})`}
            </span>
            <button className="speakBtn" type="button" onClick={speak}>
              🔊 {t("card.readAloud")}
            </button>
          </div>

          {whatText && (
            <div className="details-section">
              <span className="details-label">{t("card.whatItIs")}</span>
              <p className="details-desc">{whatText}</p>
            </div>
          )}

          {status === "low" && whyLowText && (
            <div className="details-section">
              <span className="details-label">{t("card.whyLow")}</span>
              <p className="details-desc">{whyLowText}</p>
            </div>
          )}

          {status === "high" && whyHighText && (
            <div className="details-section">
              <span className="details-label">{t("card.whyHigh")}</span>
              <p className="details-desc">{whyHighText}</p>
            </div>
          )}

          {status !== "normal" && questions.length > 0 && (
            <div className="details-questions-box">
              <h4>👨‍⚕️ {t("card.askDoctor")}</h4>
              <ul>
                {questions.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
