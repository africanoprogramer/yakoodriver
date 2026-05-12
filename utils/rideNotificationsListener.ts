/**
 * rideNotificationsListener.ts
 *
 * FIXES:
 * 1. Ignora notificaciones viejas al conectar — solo muestra las NUEVAS
 *    que llegan después de que el listener empezó.
 * 2. runTransaction en acceptRideNotification para que solo 1 conductor acepte.
 * 3. markDriverAction para evitar falso "Solicitud cancelada" al aceptar.
 */

import { db } from "@/config/firebase";
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
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
  notificationStatus?: "pending" | "accepted" | "rejected" | "expired";
  createdAt: any;
}

export const listenToRideNotifications = (
  driverId: string,
  onNewNotification: (notification: RideNotification) => void,
  onNotificationsChange?: (notifications: RideNotification[]) => void,
  onNotificationRemoved?: (rideId: string) => void,
) => {
  const activeRideIds = new Set<string>();
  const driverActionRideIds = new Set<string>();

  // ── CLAVE: Flag para ignorar el primer snapshot (que trae docs viejos) ──
  let isInitialSnapshot = true;

  try {
    console.log("👂 Escuchando notificaciones pendientes para:", driverId);

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
        const added: (RideNotification & { id: string })[] = [];
        const removed: string[] = [];

        snapshot.docChanges().forEach((change) => {
          const data = {
            id: change.doc.id,
            ...change.doc.data(),
          } as RideNotification & { id: string };
          if (change.type === "added") added.push(data);
          else if (change.type === "removed")
            removed.push(data.rideId || data.id);
        });

        // ── PRIMER SNAPSHOT: son docs que ya existían, NO mostrar modal ──
        if (isInitialSnapshot) {
          isInitialSnapshot = false;
          const oldCount = added.length;
          if (oldCount > 0) {
            console.log(
              `⏭️ Ignorando ${oldCount} notificaciones viejas al conectar`,
            );
            // Solo registrar como activas (para poder detectar cuando se remuevan)
            added.forEach((n) => activeRideIds.add(n.rideId));
          }
          return; // No llamar onNewNotification
        }

        // ── SNAPSHOTS SIGUIENTES: son cambios reales ──
        const trueAdded = added.filter((n) => !removed.includes(n.rideId));

        // Nuevas notificaciones REALES (llegaron después de conectar)
        trueAdded.forEach((notification) => {
          if (!activeRideIds.has(notification.rideId)) {
            console.log("📢 NUEVA solicitud (real):", notification.rideId);
            activeRideIds.add(notification.rideId);
            onNewNotification(notification as RideNotification);
          }
        });

        // Removidas
        removed.forEach((rideId) => {
          if (activeRideIds.has(rideId)) {
            activeRideIds.delete(rideId);
            if (driverActionRideIds.has(rideId)) {
              console.log("✅ Removido por acción del conductor:", rideId);
              driverActionRideIds.delete(rideId);
            } else {
              console.log("🚫 Removido por pasajero:", rideId);
              setTimeout(() => {
                if (onNotificationRemoved) onNotificationRemoved(rideId);
              }, 500);
            }
          }
        });

        if (onNotificationsChange) {
          onNotificationsChange(
            snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as any[],
          );
        }
      },
      (error) => console.error("❌ Error listener:", error),
    );

    const markDriverAction = (rideId: string) => {
      driverActionRideIds.add(rideId);
    };
    return { unsubscribe, markDriverAction };
  } catch (error) {
    console.error("❌ Error en listenToRideNotifications:", error);
    return { unsubscribe: () => {}, markDriverAction: (_: string) => {} };
  }
};

/**
 * Aceptar viaje — transacción atómica (solo 1 conductor puede aceptar)
 */
export const acceptRideNotification = async (
  driverId: string,
  rideId: string,
  driverData: any,
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log("✅ Intentando aceptar viaje:", rideId);
    const rideRef = doc(db, "rides", rideId);

    await runTransaction(db, async (transaction) => {
      const rideSnap = await transaction.get(rideRef);
      if (!rideSnap.exists()) throw new Error("El viaje ya no existe");

      const rideData = rideSnap.data();

      // Ya aceptado por ESTE conductor — no es error, simplemente no hacer nada
      if (rideData.status === "accepted" && rideData.acceptedBy === driverId) {
        console.log("ℹ️ Ya aceptado por ti, ignorando duplicado");
        return; // No actualizar, no lanzar error
      }

      // Aceptado por OTRO conductor
      if (rideData.status === "accepted" && rideData.acceptedBy) {
        throw new Error("Otro conductor ya aceptó este viaje");
      }

      if (rideData.status === "cancelled" || rideData.status === "expired") {
        throw new Error("El viaje fue cancelado o expiró");
      }

      transaction.update(rideRef, {
        status: "accepted",
        acceptedBy: driverId,
        acceptedByName: driverData?.fullName || "Conductor",
        acceptedByPhone: driverData?.phone || null,
        acceptedByRating: driverData?.rating || 4.5,
        acceptedByPlate: driverData?.vehicle?.licensePlate || "",
        acceptedByVehicle:
          `${driverData?.vehicle?.brand || ""} ${driverData?.vehicle?.model || ""}`.trim() ||
          "Vehículo",
        acceptedByVehicleColor: driverData?.vehicle?.color || "",
        acceptedAt: new Date(),
      });
    });

    await updateDoc(doc(db, "drivers", driverId, "rideNotifications", rideId), {
      notificationStatus: "accepted",
      acceptedAt: serverTimestamp(),
    });

    console.log("✅ Viaje aceptado por:", driverId);
    return { success: true };
  } catch (error: any) {
    console.error("❌ Error aceptando:", error.message || error);
    return { success: false, error: error.message || String(error) };
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
    await updateDoc(doc(db, "drivers", driverId, "rideNotifications", rideId), {
      notificationStatus: "rejected",
      rejectedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};

/**
 * Expirar notificación
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
    return { success: false, error: String(error) };
  }
};
