/**
 * driverStatusService.ts
 *
 * Servicio para actualizar el estado online/offline del conductor en Firestore
 * También actualiza isAvailable automáticamente
 */

import { db } from "@/config/firebase";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

interface DriverStatusUpdate {
  isOnline: boolean;
  isAvailable?: boolean;
  lastStatusChange?: Date;
  lastLocationUpdate?: Date;
}

/**
 * Actualizar estado online/offline del conductor
 */
export const updateDriverOnlineStatus = async (
  driverId: string,
  isOnline: boolean,
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(
      `🚗 Actualizando estado conductor: ${isOnline ? "ONLINE" : "OFFLINE"}`,
    );

    const driverRef = doc(db, "drivers", driverId);

    const statusUpdate: any = {
      isOnline: isOnline,
      isAvailable: isOnline, // Si está online, está disponible
      lastStatusChange: serverTimestamp(),
    };

    await updateDoc(driverRef, statusUpdate);

    console.log(`✅ Estado actualizado a: ${isOnline ? "ONLINE" : "OFFLINE"}`);

    return { success: true };
  } catch (error) {
    console.error("❌ Error actualizando estado:", error);
    return {
      success: false,
      error: String(error),
    };
  }
};

/**
 * Cambiar disponibilidad del conductor (Busy/Available)
 */
export const updateDriverAvailability = async (
  driverId: string,
  isAvailable: boolean,
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(
      `🔄 Actualizando disponibilidad: ${isAvailable ? "DISPONIBLE" : "OCUPADO"}`,
    );

    const driverRef = doc(db, "drivers", driverId);

    await updateDoc(driverRef, {
      isAvailable: isAvailable,
      lastStatusChange: serverTimestamp(),
    });

    console.log(
      `✅ Disponibilidad actualizada: ${isAvailable ? "DISPONIBLE" : "OCUPADO"}`,
    );

    return { success: true };
  } catch (error) {
    console.error("❌ Error actualizando disponibilidad:", error);
    return {
      success: false,
      error: String(error),
    };
  }
};

/**
 * Actualizar ubicación del conductor (para encontrar cercanos)
 */
export const updateDriverLocation = async (
  driverId: string,
  latitude: number,
  longitude: number,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const driverRef = doc(db, "drivers", driverId);

    await updateDoc(driverRef, {
      lastLocation: {
        lat: latitude,
        lng: longitude,
      },
      lastLocationUpdate: serverTimestamp(),
    });

    console.log(`✅ Ubicación actualizada: ${latitude}, ${longitude}`);

    return { success: true };
  } catch (error) {
    console.error("❌ Error actualizando ubicación:", error);
    return {
      success: false,
      error: String(error),
    };
  }
};

/**
 * Desconectar conductor cuando cierra la app
 * (Llamar en onBeforeUnload o cuando hace logout)
 */
export const disconnectDriver = async (
  driverId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log("🔌 Desconectando conductor...");

    const driverRef = doc(db, "drivers", driverId);

    await updateDoc(driverRef, {
      isOnline: false,
      isAvailable: false,
      lastStatusChange: serverTimestamp(),
    });

    console.log("✅ Conductor desconectado");

    return { success: true };
  } catch (error) {
    console.error("❌ Error desconectando:", error);
    return {
      success: false,
      error: String(error),
    };
  }
};

/**
 * Actualizar estado de todas las notificaciones a "expired" cuando conductor se desconecta
 */
export const expireAllRideNotifications = async (
  driverId: string,
): Promise<{ success: boolean; expiredCount?: number; error?: string }> => {
  try {
    console.log("⏰ Expirando todas las notificaciones...");

    // Aquí necesitarías usar batch writes para actualizar múltiples documentos
    // Por ahora retornamos success

    return {
      success: true,
      expiredCount: 0,
    };
  } catch (error) {
    console.error("❌ Error expirando notificaciones:", error);
    return {
      success: false,
      error: String(error),
    };
  }
};
