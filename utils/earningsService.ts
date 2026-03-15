/**
 * earningsService.ts
 * Lógica financiera Yakoo:
 * - Pasajero paga en efectivo al conductor
 * - Yakoo descuenta 10% del balance del conductor
 * - Conductor gana 90% neto
 */

import { db } from "@/config/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

/**
 * Actualizar ganancias del conductor después de completar viaje
 * con lógica de comisión del 10%
 */
export const updateDriverEarnings = async (
  driverId: string,
  driverEarnings: number, // 90% — lo que gana el conductor
  rideId: string,
  commission: number = 0, // 10% — comisión de Yakoo
): Promise<{
  success: boolean;
  error?: string;
  newEarnings?: number;
  newBalance?: number;
}> => {
  try {
    const fare = driverEarnings + commission;
    console.log(`💰 Viaje completado:`);
    console.log(`   Tarifa total:     ${fare} XAF`);
    console.log(`   Comisión Yakoo:  -${commission} XAF (10%)`);
    console.log(`   Ganancia neta:    ${driverEarnings} XAF (90%)`);

    const driverRef = doc(db, "drivers", driverId);

    // 1. Actualizar ganancias y descontar comisión del balance
    await updateDoc(driverRef, {
      totalEarnings: increment(driverEarnings), // suma el 90%
      totalTrips: increment(1), // suma 1 viaje
      balance: increment(-commission), // resta el 10% del balance
      lastEarningUpdate: serverTimestamp(),
    });

    // 2. Guardar registro en subcollección earnings
    const earningRef = doc(db, "drivers", driverId, "earnings", rideId);
    await setDoc(earningRef, {
      rideId,
      fare, // tarifa total cobrada al pasajero
      commission, // 10% que se queda Yakoo
      driverEarnings, // 90% que gana el conductor
      commissionRate: 0.1,
      paymentMethod: "cash",
      status: "completed",
      completedAt: serverTimestamp(),
    });

    // 3. Obtener datos actualizados
    const updatedDriver = await getDoc(driverRef);
    const data = updatedDriver.data();
    const newEarnings = data?.totalEarnings || 0;
    const newBalance = data?.balance || 0;

    console.log(`✅ Ganancias totales: ${newEarnings} XAF`);
    console.log(`✅ Balance restante:  ${newBalance} XAF`);

    // 4. Advertir si el balance está bajo
    if (newBalance < 500) {
      console.warn(
        `⚠️ Balance bajo: ${newBalance} XAF. El conductor debe recargar.`,
      );
    }

    return {
      success: true,
      newEarnings,
      newBalance,
    };
  } catch (error) {
    console.error("❌ Error actualizando ganancias:", error);
    return {
      success: false,
      error: String(error),
    };
  }
};

/**
 * Verificar si el conductor tiene suficiente balance para aceptar viajes
 * Mínimo recomendado: 200 XAF
 */
export const checkDriverBalance = async (
  driverId: string,
): Promise<{
  success: boolean;
  balance?: number;
  canAcceptRides?: boolean;
  error?: string;
}> => {
  try {
    const driverRef = doc(db, "drivers", driverId);
    const driverDoc = await getDoc(driverRef);

    if (!driverDoc.exists()) {
      return { success: false, error: "Conductor no encontrado" };
    }

    const balance = driverDoc.data()?.balance || 0;
    const canAcceptRides = balance >= 200; // mínimo 200 XAF de balance

    return {
      success: true,
      balance,
      canAcceptRides,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};

/**
 * Recargar balance del conductor (operación manual por admin)
 */
export const rechargeDriverBalance = async (
  driverId: string,
  amount: number,
): Promise<{ success: boolean; newBalance?: number; error?: string }> => {
  try {
    const driverRef = doc(db, "drivers", driverId);

    await updateDoc(driverRef, {
      balance: increment(amount),
      lastRecharge: serverTimestamp(),
      lastRechargeAmount: amount,
    });

    const updatedDoc = await getDoc(driverRef);
    const newBalance = updatedDoc.data()?.balance || 0;

    console.log(
      `✅ Balance recargado: +${amount} XAF. Nuevo total: ${newBalance} XAF`,
    );

    return { success: true, newBalance };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};

/**
 * Obtener ganancias actuales del conductor
 */
export const getDriverEarnings = async (
  driverId: string,
): Promise<{
  success: boolean;
  earnings?: number;
  balance?: number;
  error?: string;
}> => {
  try {
    const driverRef = doc(db, "drivers", driverId);
    const driverDoc = await getDoc(driverRef);

    if (!driverDoc.exists()) {
      return { success: false, error: "Conductor no encontrado" };
    }

    const data = driverDoc.data();
    return {
      success: true,
      earnings: data?.totalEarnings || 0,
      balance: data?.balance || 0,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};

/**
 * Obtener historial de ganancias del conductor
 */
export const getEarningsHistory = async (
  driverId: string,
  limitCount: number = 10,
): Promise<{ success: boolean; earnings?: any[]; error?: string }> => {
  try {
    const earningsRef = collection(db, "drivers", driverId, "earnings");
    const q = query(
      earningsRef,
      orderBy("completedAt", "desc"),
      limit(limitCount),
    );
    const snapshot = await getDocs(q);

    const earnings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { success: true, earnings };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};
