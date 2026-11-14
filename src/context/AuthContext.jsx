import { createContext, useContext, useState, useEffect } from "react";
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

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
      setUser(firebaseUser);
      if (firebaseUser) {
        setProfileLoading(true);
        try {
          const userProf = await getUserProfile(firebaseUser.uid, firebaseUser);
          if (active) setProfile(userProf);
        } catch (e) {
          console.warn("Error fetching user profile:", e);
        } finally {
          if (active) setProfileLoading(false);
        }
      } else {
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

  // Realtime subscription to current user's profile document
  useEffect(() => {
    if (!user?.uid) return;
    const unsubProfile = subscribeToUserProfile(user.uid, (updatedProfile) => {
      if (updatedProfile) {
        setProfile((prev) => ({ ...prev, ...updatedProfile }));
      }
    });
    return () => unsubProfile();
  }, [user?.uid]);

  // Login with Email & Password (Requires existing registration)
  const login = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const prof = await getUserProfile(cred.user.uid, cred.user, true);
    if (!prof) {
      await signOut(auth);
      throw new Error(
        "No registered healthcare account found for this email. Please switch to 'Create Account' to register as a Patient, Doctor, or Hospital first."
      );
    }
    setProfile(prof);
    return { user: cred.user, profile: prof };
  };

  // Signup with Role-Specific Data
  const signup = async (role, data) => {
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

    setProfile(createdProfile);
    return { user: cred.user, profile: createdProfile };
  };

  // Google Sign-In (Requires that this Google account was already registered)
  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const prof = await getUserProfile(cred.user.uid, cred.user, true);
    if (!prof) {
      const userEmail = cred.user.email;
      await signOut(auth);
      throw new Error(
        `Your Google account (${userEmail}) is not registered yet. Please switch to 'Create Account', select your portal role (Patient, Doctor, or Hospital), and register first.`
      );
    }
    setProfile(prof);
    return { user: cred.user, profile: prof };
  };

  // Signup with Google (Registers the Google account with the selected role)
  const signupWithGoogle = async (role, extraData = {}) => {
    const cred = await signInWithPopup(auth, googleProvider);
    const uid = cred.user.uid;
    const email = (cred.user.email || "").toLowerCase();
    const fullName = cred.user.displayName || extraData.fullName || (email.split("@")[0] || "User");

    // Check if already registered
    const existing = await getUserProfile(uid, cred.user, true);
    if (existing) {
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

    setProfile(createdProfile);
    return { user: cred.user, profile: createdProfile };
  };

  // Password Reset
  const resetPassword = async (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  // Logout
  const logout = async () => {
    setProfile(null);
    return signOut(auth);
  };

  // Fast Demo Role Switcher for instant evaluation & testing
  const switchDemoRole = async (targetRole) => {
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
