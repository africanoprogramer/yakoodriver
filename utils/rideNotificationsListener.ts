/**
 * rideNotificationsListener.ts
 *
 * Escucha notificaciones de viajes en tiempo real para YakooDriver.
 *
 * FLUJO:
 * 1. Query: notificationStatus == "pending"
 * 2. Cuando el pasajero cancela/expira, el cliente actualiza
 *    notificationStatus a "expired" en drivers/{driverId}/rideNotifications/{rideId}
 * 3. Firestore onSnapshot detecta que el doc ya NO cumple el query (pending),
 *    así que dispara change.type === "removed"
 * 4. Llamamos onNotificationRemoved para cerrar el modal
 */

import { db } from "@/config/firebase";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

interface RideNotification {
  rideId: string;
  userId: string;
  userEmail: string;
  userPhone?: string;
  pickup: { name: string; address: string; lat: number; lng: number };
  destination: { name: string; address: string; lat: number; lng: number };
  vehicleType: string;
  distance: number;
  estimatedPrice: number;
  notificationStatus: "pending" | "accepted" | "rejected" | "expired";
  createdAt: any;
}

/**
 * Escuchar notificaciones pendientes de viajes.
 *
 * @param onNewNotification — se llama cuando llega una NUEVA solicitud (mostrar modal)
 * @param onNotificationRemoved — se llama cuando una solicitud DESAPARECE del query
 *        (porque cambió de "pending" a "expired"/"cancelled" → cerrar modal)
 */
export const listenToRideNotifications = (
  driverId: string,
  onNewNotification: (notification: RideNotification) => void,
  onNotificationsChange?: (notifications: RideNotification[]) => void,
  onNotificationRemoved?: (rideId: string) => void,
) => {
  try {
    console.log("👂 Escuchando notificaciones pendientes...");

    const notificationsRef = collection(
      db,
      "drivers",
      driverId,
      "rideNotifications",
    );
    const q = query(
      notificationsRef,
      where("notificationStatus", "==", "pending"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allPending: RideNotification[] = [];

        snapshot.docChanges().forEach((change) => {
          const data = {
            id: change.doc.id,
            ...change.doc.data(),
          } as RideNotification & { id: string };

          if (change.type === "added") {
            console.log("📢 NUEVA solicitud:", data.rideId);
            onNewNotification(data as RideNotification);
          }

          if (change.type === "removed") {
            // El doc ya no cumple notificationStatus == "pending"
            // → fue expirado/cancelado/aceptado/rechazado
            console.log("🚫 Solicitud REMOVIDA del query:", data.rideId);
            if (onNotificationRemoved) {
              onNotificationRemoved(data.rideId);
            }
          }
        });

        // Todos los docs pendientes actuales
        snapshot.docs.forEach((d) => {
          allPending.push({ id: d.id, ...d.data() } as any);
        });

        if (onNotificationsChange) {
          onNotificationsChange(allPending);
        }
      },
      (error) => {
        console.error("❌ Error escuchando notificaciones:", error);
      },
    );

    return unsubscribe;
  } catch (error) {
    console.error("❌ Error en listenToRideNotifications:", error);
    return () => {};
  }
};

/**
 * Aceptar viaje
 */
export const acceptRideNotification = async (
  driverId: string,
  rideId: string,
  driverData: any,
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log("✅ Aceptando viaje:", rideId);

    // 1. Marcar notificación como aceptada
    await updateDoc(doc(db, "drivers", driverId, "rideNotifications", rideId), {
      notificationStatus: "accepted",
      acceptedAt: serverTimestamp(),
    });

    // 2. Actualizar ride
    await updateDoc(doc(db, "rides", rideId), {
      status: "accepted",
      acceptedBy: driverId,
      acceptedByName: driverData?.fullName,
      acceptedByPhone: driverData?.phone,
      acceptedByRating: driverData?.rating,
      acceptedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("❌ Error aceptando:", error);
    return { success: false, error: String(error) };
  }
};

/**
 * Rechazar viaje
 */
export const rejectRideNotification = async (
  driverId: string,
  rideId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log("❌ Rechazando viaje:", rideId);

    await updateDoc(doc(db, "drivers", driverId, "rideNotifications", rideId), {
      notificationStatus: "rejected",
      rejectedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("❌ Error rechazando:", error);
    return { success: false, error: String(error) };
  }
};

/**
 * Expirar notificación (timeout local)
 */
export const expireRideNotification = async (
  driverId: string,
  rideId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    await updateDoc(doc(db, "drivers", driverId, "rideNotifications", rideId), {
      notificationStatus: "expired",
      expiredAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Error expirando:", error);
    return { success: false, error: String(error) };
  }
};
