/**
 * contexts/AuthContext.tsx
 *
 * Contexto de autenticación mejorado para YakooDriver.
 * Usa onSnapshot en lugar de getDoc para mantener los datos
 * del conductor actualizados en tiempo real.
 */

import { auth, db } from "@/config/firebase";
import { signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ── Types ────────────────────────────────────────────────────────

interface VerificationStatus {
  documents: string;
  personalInfo: string;
  vehicle: string;
}

interface Vehicle {
  type: "car" | "moto" | null;
  brand: string;
  model: string;
  color: string;
  year: string;
  licensePlate: string;
  image: string | null;
  verification: string;
}

interface Documents {
  licenseFront: string | null;
  licenseBack: string | null;
  vehicleInsurance: string | null;
  passport: string | null;
  dip: string | null;
  criminalRecord: string | null;
  verification: string;
}

export interface DriverData {
  userId: string;
  email: string;
  fullName: string;
  phone: string;
  identificationNumber: string;
  profilePicture: string | null;
  rating: number;
  totalTrips: number;
  totalEarnings: number;
  balance: number;
  isOnline: boolean;
  isAvailable: boolean;
  isVerified: boolean;
  status: string;
  vehicle?: Vehicle;
  documents?: Documents;
  verificationStatus: VerificationStatus;
  createdAt?: any;
}

interface AuthContextType {
  user: any;
  driverData: DriverData | null;
  loading: boolean;
  isAuthenticated: boolean;
  isDriverVerified: boolean;
  isMotoDriver: boolean; // ← nuevo: true si el vehículo es moto
  signOut: () => Promise<void>;
  refreshDriver: () => void; // ← fuerza re-suscripción (útil tras editar perfil)
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Provider ─────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDriverVerified, setIsDriverVerified] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Ref para poder cancelar el listener de Firestore cuando cambie el usuario
  const driverUnsubRef = useRef<(() => void) | null>(null);

  const isFullyVerified = (d: DriverData) =>
    d.isVerified === true &&
    d.verificationStatus?.documents === "verified" &&
    d.verificationStatus?.personalInfo === "verified" &&
    d.verificationStatus?.vehicle === "verified";

  useEffect(() => {
    // ── 1. Escuchar cambios de autenticación ──
    const authUnsub = onAuthStateChanged(auth, (currentUser) => {
      // Cancelar listener anterior de Firestore si existe
      if (driverUnsubRef.current) {
        driverUnsubRef.current();
        driverUnsubRef.current = null;
      }

      if (!currentUser) {
        setUser(null);
        setDriverData(null);
        setIsDriverVerified(false);
        setLoading(false);
        return;
      }

      setUser(currentUser);
      console.log("🚗 Conductor autenticado:", currentUser.uid);

      // ── 2. Suscripción en tiempo real al documento del conductor ──
      const driverRef = doc(db, "drivers", currentUser.uid);

      driverUnsubRef.current = onSnapshot(
        driverRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as DriverData;
            setDriverData(data);
            setIsDriverVerified(isFullyVerified(data));

            console.log("🔄 Datos del conductor actualizados:", {
              fullName: data.fullName,
              isVerified: data.isVerified,
              vehicleType: data.vehicle?.type ?? "—",
              status: data.status,
            });
          } else {
            console.warn(
              "⚠️ Conductor autenticado sin documento en Firestore:",
              currentUser.uid,
            );
            setDriverData(null);
            setIsDriverVerified(false);
          }
          setLoading(false);
        },
        (error) => {
          console.error("❌ Error en listener de conductor:", error);
          setDriverData(null);
          setIsDriverVerified(false);
          setLoading(false);
        },
      );
    });

    return () => {
      authUnsub();
      if (driverUnsubRef.current) driverUnsubRef.current();
    };
  }, [refreshKey]); // refreshKey permite forzar una nueva suscripción

  const signOut = async () => {
    try {
      if (driverUnsubRef.current) {
        driverUnsubRef.current();
        driverUnsubRef.current = null;
      }
      await firebaseSignOut(auth);
      setUser(null);
      setDriverData(null);
      setIsDriverVerified(false);
      console.log("✅ Sesión de conductor cerrada");
    } catch (error) {
      console.error("❌ Error cerrando sesión:", error);
      throw error;
    }
  };

  const refreshDriver = () => setRefreshKey((k) => k + 1);

  const value: AuthContextType = {
    user,
    driverData,
    loading,
    isAuthenticated: !!user,
    isDriverVerified,
    isMotoDriver: driverData?.vehicle?.type === "moto",
    signOut,
    refreshDriver,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hooks ────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

/** True si el conductor está completamente verificado por el admin */
export function useIsDriverVerified() {
  return useAuth().isDriverVerified;
}

/** Datos completos del conductor, actualizados en tiempo real */
export function useDriverData() {
  return useAuth().driverData;
}

/** True si el vehículo del conductor es moto */
export function useIsMotoDriver() {
  return useAuth().isMotoDriver;
}

/** uid + email + todos los campos del conductor */
export function useCurrentDriver() {
  const { user, driverData } = useAuth();
  return { uid: user?.uid, email: user?.email, ...driverData };
}
