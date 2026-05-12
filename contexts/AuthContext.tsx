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

  // ── Viaje/Reserva actual ────────────────────────────
  /** ID del viaje de Uber/ride en curso (null si no hay) */
  currentRideId?: string | null;
  /** ID de la reserva de empresa en curso (null si no hay) */
  currentBookingId?: string | null;
  /** Fecha de actualización */
  updatedAt?: any;
}

interface AuthContextType {
  user: any;
  driverData: DriverData | null;
  loading: boolean;
  isAuthenticated: boolean;
  isDriverVerified: boolean;
  isMotoDriver: boolean;
  hasActiveTrip: boolean; // ← true si tiene un ride o booking en curso
  signOut: () => Promise<void>;
  refreshDriver: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Provider ─────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDriverVerified, setIsDriverVerified] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const driverUnsubRef = useRef<(() => void) | null>(null);

  const isFullyVerified = (d: DriverData) =>
    d.isVerified === true &&
    d.verificationStatus?.documents === "verified" &&
    d.verificationStatus?.personalInfo === "verified" &&
    d.verificationStatus?.vehicle === "verified";

  useEffect(() => {
    const authUnsub = onAuthStateChanged(auth, (currentUser) => {
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
              currentRide: data.currentRideId ?? "ninguno",
              currentBooking: data.currentBookingId ?? "ninguna",
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
  }, [refreshKey]);

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
    hasActiveTrip: !!(
      driverData?.currentRideId || driverData?.currentBookingId
    ),
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

/** True si tiene un viaje o reserva activa */
export function useHasActiveTrip() {
  return useAuth().hasActiveTrip;
}

/** uid + email + todos los campos del conductor */
export function useCurrentDriver() {
  const { user, driverData } = useAuth();
  return { uid: user?.uid, email: user?.email, ...driverData };
}
