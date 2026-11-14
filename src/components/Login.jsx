import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function Login() {
  const { t, lang, setLang, languages } = useLanguage();
  const { login, signup, loginWithGoogle, signupWithGoogle, resetPassword } = useAuth();

  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [selectedRole, setSelectedRole] = useState("patient"); // "patient" | "doctor" | "hospital"

  // Basic Auth Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Patient Fields
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("prefer_not_to_say");

  // Doctor Fields
  const [regNumber, setRegNumber] = useState("");
  const [medicalCouncil, setMedicalCouncil] = useState("Delhi Medical Council (DMC)");
  const [specialization, setSpecialization] = useState("General Medicine");
  const [affiliation, setAffiliation] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [docRef, setDocRef] = useState("");

  // Hospital Fields
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalType, setHospitalType] = useState("Multi-Speciality Hospital");
  const [city, setCity] = useState("New Delhi");
  const [state, setState] = useState("Delhi");
  const [pinCode, setPinCode] = useState("");
  const [authorizedRep, setAuthorizedRep] = useState("");
  const [generalBedsCount, setGeneralBedsCount] = useState("60");
  const [icuBedsCount, setIcuBedsCount] = useState("12");
  const [ventilatorsCount, setVentilatorsCount] = useState("4");

  // UI States
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const cleanError = (err) =>
    err.message.replace("Firebase: ", "").replace(/\(auth\/.*\)\.?/, "").trim() ||
    t("login.genericError");

  // Quick 1-Click Demo Login
  const handleQuickDemo = async (demoRole) => {
    setError("");
    setLoading(true);
    try {
      if (demoRole === "doctor") {
        await login("dr.sharma@medisync.ai", "DoctorPass@123");
      } else if (demoRole === "hospital") {
        await login("emergency@fortis.med", "HospitalPass@123");
      } else if (demoRole === "admin") {
        await login("admin@medisync.ai", "AdminPass@123");
      } else {
        await login("rahul.verma@gmail.com", "PatientPass@123");
      }
    } catch {
      // If demo user does not exist in Firebase Auth yet, auto-signup
      try {
        const dummyEmail =
          demoRole === "doctor"
            ? "dr.sharma@medisync.ai"
            : demoRole === "hospital"
            ? "emergency@fortis.med"
            : demoRole === "admin"
            ? "admin@medisync.ai"
            : "rahul.verma@gmail.com";
        const dummyPass = "Demo123456!";

        if (demoRole === "doctor") {
          await signup("doctor", {
            fullName: "Dr. Arvind Sharma",
            email: dummyEmail,
            password: dummyPass,
            phone: "+91 98112 34567",
            regNumber: "MCI-48291-DEL",
            medicalCouncil: "Delhi Medical Council (DMC)",
            specialization: "General & Laparoscopic Surgery",
            affiliation: "Apollo Clinic & Daycare",
            clinicAddress: "B-42, South Extension II, New Delhi",
          });
        } else if (demoRole === "hospital") {
          await signup("hospital", {
            hospitalName: "Fortis Escorts Heart & Multispeciality",
            email: dummyEmail,
            password: dummyPass,
            phone: "+91 11 4713 5000",
            regNumber: "HOSP-DEL-8921",
            hospitalType: "Super-Speciality",
            address: "Okhla Road, Sukhdev Vihar, New Delhi",
            city: "New Delhi",
            state: "Delhi",
            pinCode: "110025",
            authorizedRep: "Dr. V. Kapoor (Medical Director)",
            generalBedsCount: "120",
            icuBedsCount: "25",
            ventilatorsCount: "10",
          });
        } else {
          await signup("patient", {
            fullName: demoRole === "admin" ? "System Super Admin" : "Rahul Verma",
            email: dummyEmail,
            password: dummyPass,
            phone: "+91 98765 43210",
            dob: "1988-06-15",
            gender: "Male",
          });
        }
      } catch (err2) {
        setError(cleanError(err2));
      }
    } finally {
      setLoading(false);
    }
  };

  // Google Signup for Selected Role
  const handleGoogleSignup = async () => {
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const res = await signupWithGoogle(selectedRole, {
        fullName,
        phone,
        regNumber,
        medicalCouncil,
        specialization,
        affiliation,
        clinicAddress,
        hospitalName,
        hospitalType,
        dob,
        gender,
      });
      if (res.alreadyRegistered) {
        setSuccessMsg(`Google account recognized! Logged in as ${res.profile.role.toUpperCase()}.`);
      }
    } catch (err) {
      setError(cleanError(err));
    } finally {
      setLoading(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (mode === "forgot") {
        if (!email.trim()) throw new Error("Please enter your registered email address.");
        await resetPassword(email);
        setSuccessMsg("Password reset link sent to your email. Please check your inbox.");
        setLoading(false);
        return;
      }

      if (mode === "login") {
        await login(email, password);
      } else {
        // Signup validation by role
        if (selectedRole === "doctor") {
          if (!regNumber.trim()) throw new Error("Medical Registration Number is required for doctor accounts.");
          await signup("doctor", {
            fullName,
            email,
            password,
            phone,
            regNumber,
            medicalCouncil,
            specialization,
            affiliation,
            clinicAddress,
            documentsRef: docRef || "NMC_REG_" + regNumber,
          });
        } else if (selectedRole === "hospital") {
          if (!hospitalName.trim()) throw new Error("Hospital Name is required.");
          if (!regNumber.trim()) throw new Error("Hospital Registration / License Number is required.");
          await signup("hospital", {
            hospitalName,
            email,
            password,
            phone,
            regNumber,
            hospitalType,
            address: clinicAddress,
            city,
            state,
            pinCode,
            authorizedRep,
            generalBedsCount,
            icuBedsCount,
            ventilatorsCount,
          });
        } else {
          // Patient
          await signup("patient", {
            fullName,
            email,
            password,
            phone,
            dob,
            gender,
          });
        }
      }
    } catch (err) {
      setError(cleanError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="authPage">
      <div className="authCard" style={{ maxWidth: mode === "signup" ? "540px" : "440px" }}>
        {/* Language selector & Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div className="pn-brand-title" style={{ fontSize: "1.1rem" }}>
            <span className="brand-med">Med</span>
            <span className="brand-report">ora</span>
            <span className="brand-ai-badge">AI</span>
          </div>
          <select
            className="lang-select-pill"
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

        {/* Sleek Segmented Control for Sign In / Create Account */}
        <div className="auth-segmented-dock">
          <button
            type="button"
            className={`auth-segmented-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => { setMode("login"); setError(""); setSuccessMsg(""); }}
          >
            <span>Sign In</span>
          </button>
          <button
            type="button"
            className={`auth-segmented-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => { setMode("signup"); setError(""); setSuccessMsg(""); }}
          >
            <span>Create Account</span>
          </button>
        </div>

        {/* Title & Context Subtitle */}
        <h1 style={{ fontSize: "1.45rem", marginBottom: "6px", color: "#0f172a" }}>
          {mode === "forgot"
            ? "Reset Your Password"
            : mode === "signup"
            ? "Create Your Healthcare Account"
            : "Sign In to Your Healthcare Portal"}
        </h1>
        <p className="tag" style={{ marginBottom: "20px", color: "#64748b", lineHeight: "1.45" }}>
          {mode === "forgot"
            ? "Enter your registered email to receive a password reset link."
            : mode === "signup"
            ? "Select your account type to access your specialized portal."
            : "Log in to continue to your reports, clinical referrals, or hospital desk."}
        </p>

        <form onSubmit={handleSubmit}>
          {/* Role Selection for Registration */}
          {mode === "signup" && (
            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", color: "#0f5c63", display: "block", marginBottom: "8px" }}>
                Select Your Role / Account Type:
              </label>
              <div className="role-selector-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  className={`role-select-card ${selectedRole === "patient" ? "selected" : ""}`}
                  onClick={() => setSelectedRole("patient")}
                >
                  <span style={{ fontSize: "1.4rem" }}>👤</span>
                  <strong>Patient</strong>
                  <small>Lab Reports &amp; Referrals</small>
                </button>
                <button
                  type="button"
                  className={`role-select-card ${selectedRole === "doctor" ? "selected" : ""}`}
                  onClick={() => setSelectedRole("doctor")}
                >
                  <span style={{ fontSize: "1.4rem" }}>🩺</span>
                  <strong>Doctor</strong>
                  <small>Clinician Referral Desk</small>
                </button>
                <button
                  type="button"
                  className={`role-select-card ${selectedRole === "hospital" ? "selected" : ""}`}
                  onClick={() => setSelectedRole("hospital")}
                >
                  <span style={{ fontSize: "1.4rem" }}>🏥</span>
                  <strong>Hospital</strong>
                  <small>Bed &amp; Admission Desk</small>
                </button>
              </div>

              {/* One-click Google Signup for this chosen role */}
              <div style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  className="authGoogleBtn"
                  onClick={handleGoogleSignup}
                  disabled={loading}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Register with Google as {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}</span>
                </button>
              </div>

              <div className="authDivider" style={{ margin: "16px 0 12px" }}>
                <span>or register with email credentials</span>
              </div>
            </div>
          )}

          {/* Common Fields */}
          {mode === "signup" && (
            <>
              <label className="field-lbl">
                {selectedRole === "hospital" ? "Hospital Name *" : "Full Name *"}
              </label>
              <input
                className="authInput"
                type="text"
                placeholder={selectedRole === "hospital" ? "e.g. Fortis Escorts Hospital" : "e.g. Dr. Rajesh Sharma"}
                value={selectedRole === "hospital" ? hospitalName : fullName}
                onChange={(e) => selectedRole === "hospital" ? setHospitalName(e.target.value) : setFullName(e.target.value)}
                required
              />

              <label className="field-lbl">Phone Number *</label>
              <input
                className="authInput"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </>
          )}

          <label className="field-lbl">
            {selectedRole === "hospital" && mode === "signup" ? "Official Hospital Email *" : "Email Address *"}
          </label>
          <input
            className="authInput"
            type="email"
            placeholder={selectedRole === "hospital" ? "admissions@hospital.org" : "you@example.com"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          {mode !== "forgot" && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label className="field-lbl" style={{ margin: 0 }}>Password *</label>
                {mode === "login" && (
                  <button
                    type="button"
                    className="authLink"
                    style={{ fontSize: "0.78rem", fontWeight: "600", color: "#0f766e" }}
                    onClick={() => { setMode("forgot"); setError(""); setSuccessMsg(""); }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                className="authInput"
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={6}
                required
              />
            </div>
          )}

          {/* Role-Specific Fields for DOCTOR Signup */}
          {mode === "signup" && selectedRole === "doctor" && (
            <div className="role-specific-box" style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", margin: "10px 0" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "#0f5c63", marginBottom: "8px" }}>
                📋 Doctor Medical Credentials (For NMC/State Verification):
              </div>
              <label className="field-lbl">Medical Registration Number *</label>
              <input
                className="authInput"
                type="text"
                placeholder="e.g. MCI-2018-8492"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                required
              />

              <label className="field-lbl">Medical Council *</label>
              <input
                className="authInput"
                type="text"
                placeholder="e.g. Delhi Medical Council (DMC) or National Medical Commission"
                value={medicalCouncil}
                onChange={(e) => setMedicalCouncil(e.target.value)}
                required
              />

              <label className="field-lbl">Specialization *</label>
              <input
                className="authInput"
                type="text"
                placeholder="e.g. General Surgery, Cardiology, General Medicine"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                required
              />

              <label className="field-lbl">Clinic or Hospital Affiliation</label>
              <input
                className="authInput"
                type="text"
                placeholder="e.g. Apollo Polyclinic or Private Practice"
                value={affiliation}
                onChange={(e) => setAffiliation(e.target.value)}
              />

              <label className="field-lbl">Clinic Address</label>
              <input
                className="authInput"
                type="text"
                placeholder="Street address, City, PIN"
                value={clinicAddress}
                onChange={(e) => setClinicAddress(e.target.value)}
              />

              <label className="field-lbl">Registration Certificate / Verification Reference</label>
              <input
                className="authInput"
                type="text"
                placeholder="e.g. DMC/REG/2019/5842 or Certificate Reference"
                value={docRef}
                onChange={(e) => setDocRef(e.target.value)}
              />
              <small style={{ color: "#64748b", fontSize: "0.74rem", display: "block", marginTop: "4px" }}>
                ℹ️ Doctor accounts are set to <strong>PENDING_VERIFICATION</strong> upon signup. You will be able to submit referrals once verified by our medical director.
              </small>
            </div>
          )}

          {/* Role-Specific Fields for HOSPITAL Signup */}
          {mode === "signup" && selectedRole === "hospital" && (
            <div className="role-specific-box" style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", margin: "10px 0" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "#0f5c63", marginBottom: "8px" }}>
                🏥 Hospital Accreditation &amp; Capacity Setup:
              </div>
              <label className="field-lbl">Hospital License / NABH Registration No. *</label>
              <input
                className="authInput"
                type="text"
                placeholder="e.g. NABH-H-2022-0941"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                required
              />

              <label className="field-lbl">Hospital Facility Type</label>
              <select className="authInput" value={hospitalType} onChange={(e) => setHospitalType(e.target.value)}>
                <option value="Multi-Speciality Hospital">Multi-Speciality Hospital</option>
                <option value="Super-Speciality Tertiary Care">Super-Speciality Tertiary Care</option>
                <option value="Specialized Surgical Daycare (Laser/Laparoscopy)">Specialized Surgical Daycare (Laser/Laparoscopy)</option>
                <option value="Nursing Home &amp; Trauma Center">Nursing Home &amp; Trauma Center</option>
              </select>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label className="field-lbl">City *</label>
                  <input className="authInput" type="text" value={city} onChange={(e) => setCity(e.target.value)} required />
                </div>
                <div>
                  <label className="field-lbl">PIN Code *</label>
                  <input className="authInput" type="text" value={pinCode} onChange={(e) => setPinCode(e.target.value)} placeholder="110001" required />
                </div>
              </div>

              <label className="field-lbl">Authorized Representative (Medical Director / Admin)</label>
              <input
                className="authInput"
                type="text"
                placeholder="e.g. Dr. P. K. Mishra (Medical Superintendent)"
                value={authorizedRep}
                onChange={(e) => setAuthorizedRep(e.target.value)}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "8px" }}>
                <div>
                  <label className="field-lbl">General Beds</label>
                  <input className="authInput" type="number" value={generalBedsCount} onChange={(e) => setGeneralBedsCount(e.target.value)} />
                </div>
                <div>
                  <label className="field-lbl">ICU Beds</label>
                  <input className="authInput" type="number" value={icuBedsCount} onChange={(e) => setIcuBedsCount(e.target.value)} />
                </div>
                <div>
                  <label className="field-lbl">Ventilators</label>
                  <input className="authInput" type="number" value={ventilatorsCount} onChange={(e) => setVentilatorsCount(e.target.value)} />
                </div>
              </div>
              <small style={{ color: "#64748b", fontSize: "0.74rem", display: "block", marginTop: "4px" }}>
                ℹ️ Hospital accounts require Super Admin license verification before receiving live patient transfers.
              </small>
            </div>
          )}

          {/* Role-Specific Fields for PATIENT Signup */}
          {mode === "signup" && selectedRole === "patient" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <label className="field-lbl">Date of Birth (Optional)</label>
                <input className="authInput" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
              <div>
                <label className="field-lbl">Gender</label>
                <select className="authInput" value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          )}

          {error && <p className="error" role="alert">{error}</p>}
          {successMsg && <p className="success-banner" style={{ background: "#ecfdf5", color: "#065f46", padding: "10px", borderRadius: "8px", fontSize: "0.84rem", margin: "10px 0" }}>{successMsg}</p>}

          <button type="submit" className="authPrimary" disabled={loading} style={{ marginTop: "16px" }}>
            {loading
              ? (t("common.pleaseWait") || "Please wait...")
              : mode === "forgot"
              ? "Send Password Reset Link"
              : mode === "signup"
              ? `Create ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Account`
              : "Sign In"}
          </button>

          {mode === "login" && (
            <>
              <div className="authDivider" style={{ margin: "18px 0" }}>
                <span>or</span>
              </div>
              <button 
                type="button" 
                className="authGoogleBtn" 
                onClick={loginWithGoogle}
                disabled={loading}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Continue with Google</span>
              </button>
            </>
          )}

          <p className="authSwitch" style={{ marginTop: "16px", marginBottom: "0" }}>
            {mode === "signup" ? "Already have an account?" : "Need a new portal account?"}{" "}
            <button
              type="button"
              className="authLink"
              style={{ fontWeight: "700" }}
              onClick={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setError("");
                setSuccessMsg("");
              }}
            >
              {mode === "signup" ? "Sign In Here" : "Create Account"}
            </button>
          </p>
        </form>

        {/* ── Quick Demo 1-Click Login (Clean Evaluator Section at Bottom) ── */}
        {mode === "login" && (
          <div className="evaluator-demo-box">
            <div className="evaluator-demo-title">
              <span>⚡ Quick Demo 1-Click Login</span>
              <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "none", fontWeight: "500" }}>Evaluator Sandbox</span>
            </div>
            <div className="evaluator-pill-grid">
              <button
                type="button"
                className="evaluator-pill-btn"
                onClick={() => handleQuickDemo("doctor")}
                disabled={loading}
              >
                <span>🩺</span>
                <span>Verified Doctor</span>
              </button>
              <button
                type="button"
                className="evaluator-pill-btn"
                onClick={() => handleQuickDemo("hospital")}
                disabled={loading}
              >
                <span>🏥</span>
                <span>Hospital Desk</span>
              </button>
              <button
                type="button"
                className="evaluator-pill-btn"
                onClick={() => handleQuickDemo("patient")}
                disabled={loading}
              >
                <span>👤</span>
                <span>Patient Portal</span>
              </button>
              <button
                type="button"
                className="evaluator-pill-btn"
                onClick={() => handleQuickDemo("admin")}
                disabled={loading}
              >
                <span>🛡️</span>
                <span>Super Admin</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
