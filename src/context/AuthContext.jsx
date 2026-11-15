import { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import {
  getUserProfile,
  subscribeToUserProfile,
  registerPatientProfile,
  registerDoctorProfile,
  registerHospitalProfile,
} from "../services/userService";

const AuthContext = createContext(null);

// Evaluator Sandbox Profiles for Instant 1-Click Demo Login
const DEMO_PROFILES = {
  doctor: {
    uid: "demo-doctor-dr-sharma",
    email: "dr.sharma@medisync.ai",
    displayName: "Dr. Arvind Sharma",
    role: "doctor",
    accountStatus: "ACTIVE",
    verificationStatus: "VERIFIED",
    fullName: "Dr. Arvind Sharma",
    phone: "+91 98112 34567",
    regNumber: "MCI-48291-DEL",
    medicalCouncil: "Delhi Medical Council (DMC)",
    specialization: "General & Laparoscopic Surgery",
    affiliation: "Apollo Clinic & Daycare",
    clinicAddress: "B-42, South Extension II, New Delhi",
  },
  hospital: {
    uid: "demo-hospital-fortis",
    email: "emergency@fortis.med",
    displayName: "Fortis Escorts Hospital",
    role: "hospital",
    accountStatus: "ACTIVE",
    verificationStatus: "VERIFIED",
    hospitalName: "Fortis Escorts Heart & Multispeciality",
    phone: "+91 11 4713 5000",
    regNumber: "HOSP-DEL-8921",
    hospitalType: "Super-Speciality",
    address: "Okhla Road, Sukhdev Vihar, New Delhi",
    city: "New Delhi",
    state: "Delhi",
    pinCode: "110025",
    generalBedsCount: 120,
    icuBedsCount: 25,
    ventilatorsCount: 10,
  },
  admin: {
    uid: "demo-admin-system",
    email: "admin@medisync.ai",
    displayName: "System Super Admin",
    role: "admin",
    accountStatus: "ACTIVE",
    verificationStatus: "VERIFIED",
    fullName: "System Super Admin",
    phone: "+91 98765 00000",
  },
  patient: {
    uid: "demo-patient-rahul",
    email: "rahul.verma@gmail.com",
    displayName: "Rahul Verma",
    role: "patient",
    accountStatus: "ACTIVE",
    verificationStatus: "VERIFIED",
    fullName: "Rahul Verma",
    phone: "+91 98765 43210",
    dob: "1988-06-15",
    gender: "Male",
  },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem("medora_demo_user");
      return saved ? JSON.parse(saved) : undefined;
    } catch {
      return undefined;
    }
  }); // undefined = loading

  const [profile, setProfile] = useState(() => {
    try {
      const saved = sessionStorage.getItem("medora_demo_profile");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [profileLoading, setProfileLoading] = useState(() => {
    try {
      return !sessionStorage.getItem("medora_demo_user");
    } catch {
      return true;
    }
  });

  const [authError, setAuthError] = useState("");

  const isAuthActionInProgress = useRef(false);

  // Monitor Firebase Auth State
  useEffect(() => {
    let active = true;

    // Safety fallback: ensure splash never stays stuck if Firebase takes long to initialize
    const safetyTimer = setTimeout(() => {
      if (active) {
        setUser((prev) => (prev === undefined ? null : prev));
        setProfileLoading(false);
      }
    }, 1500);

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(safetyTimer);
      if (!active) return;

      // If active demo evaluator session exists, maintain it seamlessly
      try {
        const savedDemo = sessionStorage.getItem("medora_demo_user");
        const savedProf = sessionStorage.getItem("medora_demo_profile");
        if (savedDemo && savedProf) {
          setUser(JSON.parse(savedDemo));
          setProfile(JSON.parse(savedProf));
          setProfileLoading(false);
          return;
        }
      } catch {}

      // If an explicit login or signup flow is actively handling the auth transition, let it finish
      if (isAuthActionInProgress.current) {
        return;
      }

      if (firebaseUser) {
        setProfileLoading(true);
        try {
          const userProf = await getUserProfile(firebaseUser.uid, firebaseUser);
          if (!active) return;

          if (userProf) {
            setUser(firebaseUser);
            setProfile(userProf);
          } else {
            // User authenticated in Firebase Auth, but NOT registered in Medora!
            // Sign out to prevent unauthorized access to the application
            await signOut(auth).catch(() => {});
            if (active) {
              setUser(null);
              setProfile(null);
              setAuthError(
                `Account (${firebaseUser.email || "this email"}) is not registered. Please sign up first as a Patient, Doctor, or Hospital.`
              );
            }
          }
        } catch (e) {
          console.warn("Error fetching user profile:", e);
          if (active) {
            await signOut(auth).catch(() => {});
            setUser(null);
            setProfile(null);
          }
        } finally {
          if (active) setProfileLoading(false);
        }
      } else {
        setUser(null);
        setProfile(null);
        setProfileLoading(false);
      }
    });

    return () => {
      active = false;
      clearTimeout(safetyTimer);
      unsubscribeAuth();
    };
  }, []);

  // Realtime subscription to current user's profile document (skipped for local demo accounts)
  useEffect(() => {
    if (!user?.uid || user.uid.startsWith("demo-")) return;
    const unsubProfile = subscribeToUserProfile(user.uid, (updatedProfile) => {
      if (updatedProfile) {
        setProfile((prev) => ({ ...prev, ...updatedProfile }));
      }
    });
    return () => unsubProfile();
  }, [user?.uid]);

  // Login with Email & Password (Requires existing registration)
  const login = async (email, password) => {
    isAuthActionInProgress.current = true;
    setAuthError("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const prof = await getUserProfile(cred.user.uid, cred.user);
      if (!prof) {
        await signOut(auth);
        setUser(null);
        setProfile(null);
        const notRegMsg = `Account (${email}) is not registered. Please sign up first as a Patient, Doctor, or Hospital.`;
        setAuthError(notRegMsg);
        throw new Error(notRegMsg);
      }
      setUser(cred.user);
      setProfile(prof);
      return { user: cred.user, profile: prof };
    } catch (err) {
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/invalid-credential" ||
        err.message?.includes("user-not-found")
      ) {
        const notRegMsg = "Account is not registered. Please sign up first as a Patient, Doctor, or Hospital.";
        setAuthError(notRegMsg);
        throw new Error(notRegMsg);
      }
      throw err;
    } finally {
      isAuthActionInProgress.current = false;
    }
  };

  // Signup with Role-Specific Data
  const signup = async (role, data) => {
    isAuthActionInProgress.current = true;
    setAuthError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const uid = cred.user.uid;

      let createdProfile;
      if (role === "doctor") {
        createdProfile = await registerDoctorProfile(uid, data);
      } else if (role === "hospital") {
        createdProfile = await registerHospitalProfile(uid, data);
      } else {
        createdProfile = await registerPatientProfile(uid, data);
      }

      setUser(cred.user);
      setProfile(createdProfile);
      return { user: cred.user, profile: createdProfile };
    } finally {
      isAuthActionInProgress.current = false;
    }
  };

  // Google Sign-In (Requires that this Google account was already registered)
  const loginWithGoogle = async () => {
    isAuthActionInProgress.current = true;
    setAuthError("");
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const prof = await getUserProfile(cred.user.uid, cred.user);
      if (!prof) {
        const userEmail = cred.user.email || "";
        await signOut(auth);
        setUser(null);
        setProfile(null);
        const notRegMsg = `Account (${userEmail}) is not registered. Please sign up first as a Patient, Doctor, or Hospital.`;
        setAuthError(notRegMsg);
        throw new Error(notRegMsg);
      }
      setUser(cred.user);
      setProfile(prof);
      return { user: cred.user, profile: prof };
    } finally {
      isAuthActionInProgress.current = false;
    }
  };

  // Signup with Google (Registers the Google account with the selected role)
  const signupWithGoogle = async (role, extraData = {}) => {
    isAuthActionInProgress.current = true;
    setAuthError("");
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const uid = cred.user.uid;
      const email = (cred.user.email || "").toLowerCase();
      const fullName = cred.user.displayName || extraData.fullName || (email.split("@")[0] || "User");

      // Check if already registered
      const existing = await getUserProfile(uid, cred.user);
      if (existing) {
        setUser(cred.user);
        setProfile(existing);
        return { user: cred.user, profile: existing, alreadyRegistered: true };
      }

      let createdProfile;
      if (role === "doctor") {
        createdProfile = await registerDoctorProfile(uid, {
          fullName,
          email,
          phone: extraData.phone || "",
          regNumber: extraData.regNumber || "NMC-GOOGLE-" + Math.floor(1000 + Math.random() * 9000),
          medicalCouncil: extraData.medicalCouncil || "Delhi Medical Council (DMC)",
          specialization: extraData.specialization || "General Medicine",
          affiliation: extraData.affiliation || "Primary Care Clinic",
          clinicAddress: extraData.clinicAddress || "Clinic Address",
        });
      } else if (role === "hospital") {
        createdProfile = await registerHospitalProfile(uid, {
          hospitalName: extraData.hospitalName || `${fullName}'s Healthcare Center`,
          email,
          phone: extraData.phone || "",
          regNumber: extraData.regNumber || "HOSP-REG-" + Math.floor(1000 + Math.random() * 9000),
          hospitalType: extraData.hospitalType || "Multi-Speciality",
          address: extraData.address || "City Hospital Campus",
          city: extraData.city || "New Delhi",
          state: extraData.state || "Delhi",
          pinCode: extraData.pinCode || "",
          authorizedRep: fullName,
        });
      } else {
        // Patient
        createdProfile = await registerPatientProfile(uid, {
          fullName,
          email,
          phone: extraData.phone || "",
          dob: extraData.dob || "",
          gender: extraData.gender || "prefer_not_to_say",
        });
      }

      setUser(cred.user);
      setProfile(createdProfile);
      return { user: cred.user, profile: createdProfile };
    } finally {
      isAuthActionInProgress.current = false;
    }
  };

  // Password Reset
  const resetPassword = async (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  // Logout
  const logout = async () => {
    try {
      sessionStorage.removeItem("medora_demo_user");
      sessionStorage.removeItem("medora_demo_profile");
      sessionStorage.removeItem("medora_demo_target");
    } catch {}
    setUser(null);
    setProfile(null);
    return signOut(auth).catch(() => {});
  };

  // Instant 1-Click Demo Login for Sandbox Evaluators
  const loginAsDemo = async (targetRole = "doctor") => {
    isAuthActionInProgress.current = true;
    setAuthError("");
    const demoProf = DEMO_PROFILES[targetRole] || DEMO_PROFILES.doctor;
    const demoUser = {
      uid: demoProf.uid,
      email: demoProf.email,
      displayName: demoProf.displayName || demoProf.fullName,
    };

    try {
      sessionStorage.setItem("medora_demo_user", JSON.stringify(demoUser));
      sessionStorage.setItem("medora_demo_profile", JSON.stringify(demoProf));
    } catch (e) {
      console.warn("Could not write demo session to storage:", e);
    }

    setUser(demoUser);
    setProfile(demoProf);
    setProfileLoading(false);
    isAuthActionInProgress.current = false;
    return { user: demoUser, profile: demoProf };
  };

  // Fast Demo Role Switcher for instant evaluation & testing
  const switchDemoRole = async (targetRole) => {
    const targetProf = DEMO_PROFILES[targetRole];
    if (targetProf) {
      await loginAsDemo(targetRole);
      return;
    }
    if (!user) return;
    const updated = {
      ...profile,
      role: targetRole,
      accountStatus: targetRole === "admin" ? "ACTIVE" : (profile?.accountStatus || "ACTIVE"),
    };
    setProfile(updated);
  };

  const role = profile?.role || "patient";
  const accountStatus = profile?.accountStatus || "ACTIVE";
  const isVerified = accountStatus === "ACTIVE";

  const value = {
    user,
    profile,
    profileLoading,
    authError,
    setAuthError,
    role,
    accountStatus,
    isVerified,
    isDoctor: role === "doctor",
    isHospital: role === "hospital",
    isPatient: role === "patient",
    isAdmin: role === "admin",
    login,
    signup,
    loginWithGoogle,
    signupWithGoogle,
    resetPassword,
    logout,
    switchDemoRole,
    loginAsDemo,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
