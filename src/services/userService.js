/**
 * MediSync AI User, Role & Profile Service
 * Manages RBAC profiles in Cloud Firestore:
 * - users/{uid}
 * - doctors/{doctorId}
 * - hospitals/{hospitalId}
 * - patients/{patientId}
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "../firebase";

const USERS_COL = "users";
const DOCTORS_COL = "doctors";
const HOSPITALS_COL = "hospitals";
const PATIENTS_COL = "patients";

// Default admin emails recognized by the system
export const ADMIN_EMAILS = [
  "admin@medisync.ai",
  "superadmin@medisync.ai",
  "prince@medisync.ai",
  "princekumar@medreport.ai",
];

/**
 * Resilient promise timeout helper to prevent hanging on Firestore network latency
 */
export function withTimeout(promise, ms = 2000, fallback = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Lookup registered profile by email in Firestore
 */
export async function findUserProfileByEmail(email) {
  if (!email || !db) return null;
  try {
    const cleanEmail = email.trim().toLowerCase();
    const q = query(collection(db, USERS_COL), where("email", "==", cleanEmail));
    const snap = await withTimeout(getDocs(q), 2000, null);
    if (snap && !snap.empty) {
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (err) {
    console.warn("findUserProfileByEmail error:", err);
    return null;
  }
}

/**
 * Fetch or verify user profile from Firestore
 * If requireExisting is true, non-registered users will return null (preventing unauthorized sign-in).
 */
export async function getUserProfile(uid, userAuth = null, requireExisting = false) {
  if (!uid || !db) return null;

  try {
    // 1. Direct UID check with resilient timeout
    const userRef = doc(db, USERS_COL, uid);
    const snap = await withTimeout(getDoc(userRef), 2000, null);

    if (snap && snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }

    const email = (userAuth?.email || auth.currentUser?.email || "").toLowerCase();

    // 2. Check by registered email (e.g. if registered with Google or registered with email/pass first)
    if (email) {
      const profileByEmail = await findUserProfileByEmail(email);
      if (profileByEmail) {
        // Link Google UID with existing registered profile
        await setDoc(userRef, { ...profileByEmail, uid, googleUid: uid, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
        return { ...profileByEmail, uid };
      }
    }

    // 3. If requireExisting is enabled, non-demo and non-admin users must register first
    const isDemoOrAdmin = ADMIN_EMAILS.includes(email) || 
      email.startsWith("admin@") || 
      email.includes("dr.sharma") || 
      email.includes("fortis") || 
      email === "rahul.verma@gmail.com";

    if (requireExisting && !isDemoOrAdmin) {
      return null;
    }

    // 4. Default provision for demo accounts & administrators
    let defaultRole = "patient";
    let defaultStatus = "ACTIVE";

    if (ADMIN_EMAILS.includes(email) || email.startsWith("admin@")) {
      defaultRole = "admin";
      defaultStatus = "ACTIVE";
    } else if (email.includes("doctor") || email.startsWith("dr.") || email.includes("dr_")) {
      defaultRole = "doctor";
      defaultStatus = "ACTIVE";
    } else if (email.includes("hospital") || email.includes("clinic") || email.includes("fortis") || email.includes("max")) {
      defaultRole = "hospital";
      defaultStatus = "ACTIVE";
    }

    const newProfile = {
      uid,
      email,
      fullName: userAuth?.displayName || (email.split("@")[0] || "User"),
      role: defaultRole,
      accountStatus: defaultStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(userRef, newProfile).catch((err) => {
      console.warn("Could not save auto-provisioned user profile:", err);
    });

    return newProfile;
  } catch (err) {
    console.warn("getUserProfile error:", err);
    if (requireExisting) return null;
    const email = (userAuth?.email || auth.currentUser?.email || "").toLowerCase();
    const isAdm = ADMIN_EMAILS.includes(email) || email.startsWith("admin@");
    const isDoc = email.includes("doctor") || email.startsWith("dr.");
    const isHosp = email.includes("hospital");
    return {
      uid,
      email,
      fullName: email.split("@")[0] || "User",
      role: isAdm ? "admin" : isDoc ? "doctor" : isHosp ? "hospital" : "patient",
      accountStatus: "ACTIVE",
    };
  }
}

/**
 * Subscribe to realtime changes of current user profile
 */
export function subscribeToUserProfile(uid, callback) {
  if (!uid || !db) {
    callback(null);
    return () => {};
  }

  const userRef = doc(db, USERS_COL, uid);
  return onSnapshot(
    userRef,
    (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() });
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn("UserProfile subscription error:", err);
    }
  );
}

/**
 * Register Patient Profile
 */
export async function registerPatientProfile(uid, patientData) {
  const profile = {
    uid,
    fullName: patientData.fullName,
    email: patientData.email.toLowerCase(),
    phone: patientData.phone || "",
    role: "patient",
    accountStatus: "ACTIVE",
    dateOfBirth: patientData.dob || "",
    gender: patientData.gender || "",
    emergencyContact: patientData.emergencyContact || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (db) {
    await setDoc(doc(db, USERS_COL, uid), profile);
    await setDoc(doc(db, PATIENTS_COL, uid), {
      userId: uid,
      fullName: patientData.fullName,
      email: patientData.email.toLowerCase(),
      phone: patientData.phone || "",
      dateOfBirth: patientData.dob || "",
      gender: patientData.gender || "",
      allergies: patientData.allergies || [],
      chronicConditions: patientData.chronicConditions || [],
      createdAt: new Date().toISOString(),
    }).catch(() => {});
  }

  return profile;
}

/**
 * Register Doctor Profile (Pending Verification)
 */
export async function registerDoctorProfile(uid, doctorData) {
  const profile = {
    uid,
    fullName: doctorData.fullName,
    email: doctorData.email.toLowerCase(),
    phone: doctorData.phone || "",
    role: "doctor",
    accountStatus: "PENDING_VERIFICATION", // Requires Admin verification
    medicalRegNumber: doctorData.regNumber,
    medicalCouncil: doctorData.medicalCouncil,
    specialization: doctorData.specialization,
    affiliation: doctorData.affiliation,
    clinicAddress: doctorData.clinicAddress,
    documentsRef: doctorData.documentsRef || "DOC_SUBMITTED_" + Date.now(),
    verificationDate: null,
    verifiedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (db) {
    await setDoc(doc(db, USERS_COL, uid), profile);
    await setDoc(doc(db, DOCTORS_COL, uid), {
      userId: uid,
      doctorId: uid,
      ...profile,
    }).catch(() => {});
  }

  return profile;
}

/**
 * Register Hospital Profile (Pending Verification)
 */
export async function registerHospitalProfile(uid, hospitalData) {
  const profile = {
    uid,
    hospitalName: hospitalData.hospitalName,
    fullName: hospitalData.hospitalName,
    email: hospitalData.email.toLowerCase(),
    phone: hospitalData.phone || "",
    role: "hospital",
    accountStatus: "PENDING_VERIFICATION", // Requires Admin verification
    registrationNumber: hospitalData.regNumber,
    hospitalType: hospitalData.hospitalType || "Multi-Speciality",
    address: hospitalData.address,
    city: hospitalData.city || "New Delhi",
    state: hospitalData.state || "Delhi",
    pinCode: hospitalData.pinCode || "",
    authorizedRepresentative: hospitalData.authorizedRep || "",
    departments: hospitalData.departments || ["General Medicine", "Emergency Care"],
    treatments: hospitalData.treatments || ["General Surgery", "Internal Medicine"],
    equipment: hospitalData.equipment || ["ICU Monitor", "Oxygen Support"],
    icuFacilities: {
      hasIcu: true,
      hasVentilators: hospitalData.hasVentilators !== false,
      availableVentilators: Number(hospitalData.ventilatorsCount) || 2,
      availableBeds: Number(hospitalData.icuBedsCount) || 4,
    },
    capacity: {
      totalGeneralBeds: Number(hospitalData.generalBedsCount) || 50,
      availableGeneralBeds: Number(hospitalData.generalBedsCount) || 20,
      occupiedGeneralBeds: 30,
      totalIcuBeds: Number(hospitalData.icuBedsCount) || 10,
      availableIcuBeds: Number(hospitalData.icuBedsCount) || 4,
      occupiedIcuBeds: 6,
      emergencyBeds: Number(hospitalData.emergencyBedsCount) || 5,
    },
    verificationStatus: "PENDING_VERIFICATION",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (db) {
    await setDoc(doc(db, USERS_COL, uid), profile);
    await setDoc(doc(db, HOSPITALS_COL, uid), {
      hospitalId: uid,
      userId: uid,
      ...profile,
    }).catch(() => {});
  }

  return profile;
}

/**
 * Admin action: Verify, Reject, or Suspend an Account
 */
export async function setAccountStatus(uid, newStatus, adminEmail = "admin@medisync.ai", reason = "") {
  if (!db || !uid) return false;

  const validStatuses = ["ACTIVE", "PENDING_VERIFICATION", "REJECTED", "SUSPENDED"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }

  const updates = {
    accountStatus: newStatus,
    statusUpdatedAt: new Date().toISOString(),
    statusUpdatedBy: adminEmail,
    statusNote: reason,
    updatedAt: new Date().toISOString(),
  };

  await updateDoc(doc(db, USERS_COL, uid), updates);

  // Sync with doctor or hospital profile if applicable
  try {
    const userDoc = await getDoc(doc(db, USERS_COL, uid));
    if (userDoc.exists()) {
      const uData = userDoc.data();
      if (uData.role === "doctor") {
        await updateDoc(doc(db, DOCTORS_COL, uid), {
          verificationStatus: newStatus === "ACTIVE" ? "VERIFIED" : newStatus,
          verifiedAt: newStatus === "ACTIVE" ? new Date().toISOString() : null,
          verifiedBy: adminEmail,
        }).catch(() => {});
      } else if (uData.role === "hospital") {
        await updateDoc(doc(db, HOSPITALS_COL, uid), {
          verificationStatus: newStatus === "ACTIVE" ? "VERIFIED" : newStatus,
          verifiedAt: newStatus === "ACTIVE" ? new Date().toISOString() : null,
          verifiedBy: adminEmail,
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.warn("Could not sync sub-collection status:", e);
  }

  return true;
}

/**
 * Admin: Get all registered users by role
 */
export async function getUsersByRole(role = "all") {
  if (!db) return [];
  try {
    const q = role === "all" 
      ? collection(db, USERS_COL)
      : query(collection(db, USERS_COL), where("role", "==", role));
    
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("getUsersByRole error:", err);
    return [];
  }
}

/**
 * Subscribe to all users for Admin
 */
export function subscribeToUsers(callback) {
  if (!db) {
    callback([]);
    return () => {};
  }

  return onSnapshot(
    collection(db, USERS_COL),
    (snap) => {
      const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(users);
    },
    (err) => {
      console.warn("subscribeToUsers error:", err);
    }
  );
}
