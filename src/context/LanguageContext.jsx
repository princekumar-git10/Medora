import React, { createContext, useContext, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n.js";
import { TRANSLATIONS, TEST_NAME_TRANSLATIONS } from "../locales/translations.js";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English", voiceLang: "en-IN" },
  { code: "hi", label: "Hindi", native: "हिंदी", voiceLang: "hi-IN" },
  { code: "bn", label: "Bengali", native: "বাংলা", voiceLang: "bn-IN" },
  { code: "ta", label: "Tamil", native: "தமிழ்", voiceLang: "ta-IN" },
  { code: "te", label: "Telugu", native: "తెలుగు", voiceLang: "te-IN" },
  { code: "mr", label: "Marathi", native: "मराठी", voiceLang: "mr-IN" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી", voiceLang: "gu-IN" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", voiceLang: "kn-IN" },
  { code: "ml", label: "Malayalam", native: "മലയാളം", voiceLang: "ml-IN" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ", voiceLang: "pa-IN" },
];

const LanguageContext = createContext(null);

function applyGoogleTranslate(newLang) {
  if (typeof document === "undefined") return;
  try {
    const cookieVal = newLang === "en" ? "" : `/en/${newLang}`;
    document.cookie = `googtrans=${cookieVal}; path=/;`;
    if (window.location.hostname) {
      document.cookie = `googtrans=${cookieVal}; path=/; domain=${window.location.hostname};`;
      document.cookie = `googtrans=${cookieVal}; path=/; domain=.${window.location.hostname};`;
    }

    const select = document.querySelector(".goog-te-combo");
    if (select) {
      select.value = newLang;
      select.dispatchEvent(new Event("change"));
    } else {
      setTimeout(() => {
        const delayedSelect = document.querySelector(".goog-te-combo");
        if (delayedSelect) {
          delayedSelect.value = newLang;
          delayedSelect.dispatchEvent(new Event("change"));
        }
      }, 500);
    }
  } catch (e) {
    console.warn("Auto-translate error:", e);
  }
}

export function LanguageProvider({ children }) {
  const { t: i18nT, i18n: i18nInstance } = useTranslation();

  const [lang, setLangState] = useState(() => {
    return localStorage.getItem("medreport_language") || "en";
  });

  const setLang = (newLang) => {
    setLangState(newLang);
    try {
      localStorage.setItem("medreport_language", newLang);
      document.documentElement.lang = newLang;
      if (i18nInstance && typeof i18nInstance.changeLanguage === "function") {
        i18nInstance.changeLanguage(newLang);
      }
      applyGoogleTranslate(newLang);
    } catch (e) {
      console.warn("Could not save language to localStorage:", e);
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    if (i18nInstance && i18nInstance.language !== lang && typeof i18nInstance.changeLanguage === "function") {
      i18nInstance.changeLanguage(lang);
    }
    applyGoogleTranslate(lang);
  }, [lang]);

  /**
   * Safe Dot-Notation Translation Lookup with Variable Interpolation
   * 1. Synchronous lookup in active language dictionary
   * 2. Fallback to English dictionary if not found in active language
   * 3. Fallback to i18next if available
   * 4. Variable interpolation: {param}
   */
  const t = (path, params = {}) => {
    if (!path || typeof path !== "string") return "";
    const keys = path.split(".");

    // 1. Direct synchronous lookup in current language dictionary
    let value = keys.reduce((acc, k) => acc?.[k], TRANSLATIONS[lang]);

    // 2. Fallback to English dictionary if missing in current language
    if ((value === undefined || typeof value !== "string") && lang !== "en") {
      value = keys.reduce((acc, k) => acc?.[k], TRANSLATIONS.en);
    }

    // 3. Fallback to i18next if available
    if (value === undefined || typeof value !== "string") {
      try {
        const iVal = i18nT(path, { ...params, lng: lang });
        if (iVal && iVal !== path && !path.endsWith(`.${iVal}`)) {
          return iVal;
        }
      } catch {}
      return keys[keys.length - 1] || path;
    }

    // 4. Interpolate variables e.g. {count}, {name}, {email}
    let res = value;
    if (params && typeof params === "object") {
      for (const [p, v] of Object.entries(params)) {
        res = res.replaceAll(`{${p}}`, v !== undefined && v !== null ? v : "");
      }
    }
    return res;
  };

  /**
   * Helper to translate test status ("normal", "high", "low", "critical", etc.)
   */
  const tStatus = (status) => {
    if (!status) return "";
    const s = String(status).toLowerCase();
    return t(`common.${s}`) || status;
  };

  /**
   * Helper to translate system/category names
   */
  const tCategory = (cat) => {
    if (!cat) return "";
    return TRANSLATIONS[lang]?.categories?.[cat] || TRANSLATIONS.en?.categories?.[cat] || cat;
  };

  /**
   * Helper to translate hospital room categories
   */
  const tRoom = (room) => {
    if (!room) return "";
    return TRANSLATIONS[lang]?.rooms?.[room] || TRANSLATIONS.en?.rooms?.[room] || room;
  };

  /**
   * Helper to translate biomarker / test names if regional translation exists
   */
  const tTestName = (name) => {
    if (!name) return "";
    return TEST_NAME_TRANSLATIONS[lang]?.[name] || name;
  };

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        t,
        tStatus,
        tCategory,
        tRoom,
        tTestName,
        languages: LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
