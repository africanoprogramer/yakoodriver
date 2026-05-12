/**
 * geoLocationService.ts
 *
 * Servicio para verificar la distancia entre conductor y pasajero
 */

import * as Location from "expo-location";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// ══════════════════════════════════════════════
// ⚠️  CAMBIAR A true SOLO PARA TESTING LOCAL
// ══════════════════════════════════════════════
export const USE_MOCK_LOCATION = false;

export enum DriverSimulation {
  VERY_FAR = "very_far",
  FAR = "far",
  CLOSE = "close",
  VERY_CLOSE = "very_close",
}

let currentSimulation: DriverSimulation = DriverSimulation.CLOSE;

export const setSimulation = (simulation: DriverSimulation) => {
  currentSimulation = simulation;
  console.log(`🎯 Simulación cambiada a: ${simulation}`);
};

// Coordenadas mock ahora son de MALABO (no Yaoundé)
const getSimulatedCoordinates = (): Coordinates => {
  const pickupLat = 3.7504;
  const pickupLng = 8.7371;

  switch (currentSimulation) {
    case DriverSimulation.VERY_FAR:
      return { latitude: 3.72, longitude: 8.7 };
    case DriverSimulation.FAR:
      return { latitude: 3.749, longitude: 8.736 };
    case DriverSimulation.CLOSE:
      return { latitude: 3.7502, longitude: 8.7369 };
    case DriverSimulation.VERY_CLOSE:
      return { latitude: pickupLat, longitude: pickupLng };
    default:
      return { latitude: pickupLat, longitude: pickupLng };
  }
};

const calculateDistance = (
  point1: Coordinates,
  point2: Coordinates,
): number => {
  const R = 6371000;
  const φ1 = (point1.latitude * Math.PI) / 180;
  const φ2 = (point2.latitude * Math.PI) / 180;
  const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const getCurrentLocation = async (): Promise<Coordinates | null> => {
  if (USE_MOCK_LOCATION) {
    const mockCoords = getSimulatedCoordinates();
    console.log(
      `📍 MOCK: ${mockCoords.latitude}, ${mockCoords.longitude} [${currentSimulation}]`,
    );
    return mockCoords;
  }

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      console.error("❌ Permiso denegado");
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });

    console.log(
      `✅ GPS: ${location.coords.latitude}, ${location.coords.longitude}`,
    );
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error("❌ Error GPS:", error);
    return null;
  }
};

export const isNearPickupLocation = async (
  pickupLocation: Coordinates,
  maxDistance: number = 100,
): Promise<{ isNear: boolean; distance: number; message: string }> => {
  try {
    const driverLocation = await getCurrentLocation();
    if (!driverLocation)
      return {
        isNear: false,
        distance: maxDistance + 1,
        message: "No se pudo obtener ubicación",
      };

    const distance = calculateDistance(driverLocation, pickupLocation);
    const isNear = distance <= maxDistance;
    const message =
      distance > maxDistance * 2
        ? `🔴 Muy lejos (${Math.round(distance)}m)`
        : distance > maxDistance
          ? `🟡 Casi llego (${Math.round(distance)}m)`
          : `🟢 Cerca (${Math.round(distance)}m)`;

    return { isNear, distance, message };
  } catch {
    return {
      isNear: false,
      distance: maxDistance + 1,
      message: "Error verificando",
    };
  }
};

export const watchLocation = (
  callback: (location: Coordinates) => void,
  onError?: (error: string) => void,
): (() => void) => {
  if (USE_MOCK_LOCATION) {
    console.log("👁️ MOCK location cada 3s");
    const interval = setInterval(() => {
      const coords = getSimulatedCoordinates();
      callback(coords);
    }, 3000);
    return () => clearInterval(interval);
  }

  // GPS REAL — pedir permisos primero
  console.log("📡 Iniciando GPS real...");

  let stopped = false;
  const cleanupRef: { subscription: any } = { subscription: null };

  (async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.error("❌ Permiso de ubicación denegado");
        if (onError) onError("Permiso de ubicación denegado");
        return;
      }

      if (stopped) return; // Ya se llamó stop() antes de obtener permisos

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 10,
        },
        (location) => {
          const coords: Coordinates = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          console.log(
            `📍 GPS real: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
          );
          callback(coords);
        },
      );

      // Guardar referencia para limpiar
      cleanupRef.subscription = subscription;
    } catch (error) {
      console.error("❌ Error iniciando GPS:", error);
      if (onError) onError(String(error));
    }
  })();

  return () => {
    stopped = true;
    if (cleanupRef.subscription) {
      cleanupRef.subscription.remove();
    }
    console.log("⏹️ GPS detenido");
  };
};

export const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};

// Debug (solo dev)
if (__DEV__) {
  (global as any).GeoDebug = {
    setSimulation,
    getSimulatedCoordinates,
    DriverSimulation,
  };
}
