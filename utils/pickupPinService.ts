/**
 * pinService.ts
 *
 * Servicio para generar, almacenar y verificar PINs
 * de confirmación de recogida
 */

import { db } from "@/config/firebase";
import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    updateDoc,
} from "firebase/firestore";

interface PinSession {
  pin: string;
  rideId: string;
  createdAt: any;
  expiresAt: any;
  used: boolean;
  verifiedAt?: any;
}

/**
 * Generar PIN aleatorio de 4 dígitos
 */
export const generatePin = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Crear nueva sesión de PIN
 * PIN válido por 5 minutos
 */
export const createPinSession = async (rideId: string): Promise<string> => {
  try {
    const pin = generatePin();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutos

    console.log(`📌 Generando PIN para ride ${rideId}: ${pin}`);

    // Guardar en subcollección
    const pinDocRef = doc(
      db,
      "rides",
      rideId,
      "pickupConfirmation",
      "currentPin",
    );

    await setDoc(pinDocRef, {
      pin,
      rideId,
      createdAt: serverTimestamp(),
      expiresAt,
      used: false,
    });

    console.log(
      `✅ PIN creado: ${pin} (válido hasta ${expiresAt.toLocaleTimeString()})`,
    );

    return pin;
  } catch (error) {
    console.error("❌ Error creando PIN:", error);
    throw error;
  }
};

/**
 * Verificar que el PIN es correcto
 * - Existe
 * - No ha expirado
 * - No ha sido usado
 */
export const verifyPin = async (
  rideId: string,
  inputPin: string,
): Promise<boolean> => {
  try {
    console.log(`🔍 Verificando PIN: ${inputPin} para ride: ${rideId}`);

    const pinDocRef = doc(
      db,
      "rides",
      rideId,
      "pickupConfirmation",
      "currentPin",
    );
    const pinDoc = await getDoc(pinDocRef);

    // PIN no existe
    if (!pinDoc.exists()) {
      console.error("❌ PIN no encontrado");
      return false;
    }

    const data = pinDoc.data() as PinSession;

    // PIN ya fue usado
    if (data.used) {
      console.error("❌ PIN ya fue utilizado");
      return false;
    }

    // PIN ha expirado
    const now = new Date();
    if (now > data.expiresAt.toDate()) {
      console.error("❌ PIN expirado");
      return false;
    }

    // PIN no coincide
    if (data.pin !== inputPin) {
      console.error("❌ PIN incorrecto");
      return false;
    }

    // ✅ PIN válido - marcar como usado
    console.log("✅ PIN verificado correctamente");

    await updateDoc(pinDocRef, {
      used: true,
      verifiedAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.error("❌ Error verificando PIN:", error);
    throw error;
  }
};

/**
 * Obtener PIN actual (para mostrar al pasajero)
 */
export const getCurrentPin = async (rideId: string): Promise<string | null> => {
  try {
    const pinDocRef = doc(
      db,
      "rides",
      rideId,
      "pickupConfirmation",
      "currentPin",
    );
    const pinDoc = await getDoc(pinDocRef);

    if (!pinDoc.exists()) {
      return null;
    }

    const data = pinDoc.data() as PinSession;

    // Si ya fue usado, generar uno nuevo
    if (data.used) {
      return await createPinSession(rideId);
    }

    // Si expiró, generar uno nuevo
    const now = new Date();
    if (now > data.expiresAt.toDate()) {
      return await createPinSession(rideId);
    }

    return data.pin;
  } catch (error) {
    console.error("❌ Error obteniendo PIN:", error);
    return null;
  }
};

/**
 * Limpiar PIN después de viaje completado
 */
export const cleanupPin = async (rideId: string): Promise<void> => {
  try {
    const pinDocRef = doc(
      db,
      "rides",
      rideId,
      "pickupConfirmation",
      "currentPin",
    );
    await updateDoc(pinDocRef, {
      used: true,
      cleanedAt: serverTimestamp(),
    });

    console.log("✅ PIN limpiado después de viaje");
  } catch (error) {
    console.error("❌ Error limpiando PIN:", error);
  }
};
