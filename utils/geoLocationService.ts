/**
 * geoLocationService.ts
 *
 * Servicio para verificar la distancia entre conductor y pasajero
 * Con soporte para MOCK y simulación de movimiento
 */

import * as Location from "expo-location";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * ============================================
 * CONFIGURACIÓN DE TESTING
 * ============================================
 */

// Cambiar a false cuando quieras GPS real
export const USE_MOCK_LOCATION = true;

// Simulación de movimiento del conductor
// Cambiar esto para simular diferentes distancias
export enum DriverSimulation {
  VERY_FAR = "very_far", // 🔴 8km de distancia
  FAR = "far", // 🟡 500m de distancia
  CLOSE = "close", // 🟢 50m de distancia
  VERY_CLOSE = "very_close", // 🟢 5m de distancia (aquí mismo)
}

// Simulación actual - CAMBIAR ESTO PARA PROBAR DIFERENTES ESCENARIOS
let currentSimulation: DriverSimulation = DriverSimulation.VERY_FAR;

/**
 * Cambiar la simulación de ubicación en tiempo real
 * Útil para testing sin tocar el código
 */
export const setSimulation = (simulation: DriverSimulation) => {
  currentSimulation = simulation;
  console.log(`🎯 Simulación cambiada a: ${simulation}`);
};

/**
 * Obtener las coordenadas simuladas basadas en la simulación actual
 */
const getSimulatedCoordinates = (): Coordinates => {
  const passengerLat = 3.8667;
  const passengerLng = 11.5167;

  switch (currentSimulation) {
    case DriverSimulation.VERY_FAR:
      // 🔴 8km de distancia (al norte)
      return {
        latitude: 3.86,
        longitude: 11.51,
      };

    case DriverSimulation.FAR:
      // 🟡 500m de distancia (al noreste)
      return {
        latitude: 3.8655,
        longitude: 11.516,
      };

    case DriverSimulation.CLOSE:
      // 🟢 50m de distancia (muy cerca)
      return {
        latitude: 3.86665,
        longitude: 11.51665,
      };

    case DriverSimulation.VERY_CLOSE:
      // 🟢 5m de distancia (aquí mismo)
      return {
        latitude: passengerLat,
        longitude: passengerLng,
      };

    default:
      return {
        latitude: passengerLat,
        longitude: passengerLng,
      };
  }
};

/**
 * Calcular distancia en metros entre dos puntos
 * usando la fórmula de Haversine
 */
const calculateDistance = (
  point1: Coordinates,
  point2: Coordinates,
): number => {
  const R = 6371000; // Radio de la tierra en metros
  const φ1 = (point1.latitude * Math.PI) / 180;
  const φ2 = (point2.latitude * Math.PI) / 180;
  const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Obtener ubicación actual del dispositivo
 * Si USE_MOCK_LOCATION está activado, retorna ubicación simulada
 */
export const getCurrentLocation = async (): Promise<Coordinates | null> => {
  if (USE_MOCK_LOCATION) {
    const mockCoords = getSimulatedCoordinates();
    console.log(
      `📍 MOCK LOCATION: ${mockCoords.latitude}, ${mockCoords.longitude} [${currentSimulation}]`,
    );
    return mockCoords;
  }

  try {
    console.log("📍 Obteniendo ubicación actual del GPS...");

    // Solicitar permisos
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      console.error("❌ Permiso de ubicación denegado");
      return null;
    }

    // Obtener ubicación
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });

    const coords: Coordinates = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    console.log(
      `✅ Ubicación GPS obtenida: ${coords.latitude}, ${coords.longitude}`,
    );

    return coords;
  } catch (error) {
    console.error("❌ Error obteniendo ubicación:", error);
    return null;
  }
};

/**
 * Verificar si el conductor está lo suficientemente cerca
 * Distancia máxima por defecto: 100 metros
 */
export const isNearPickupLocation = async (
  pickupLocation: Coordinates,
  maxDistance: number = 100,
): Promise<{
  isNear: boolean;
  distance: number;
  message: string;
}> => {
  try {
    const driverLocation = await getCurrentLocation();

    if (!driverLocation) {
      return {
        isNear: false,
        distance: maxDistance + 1,
        message: "No se pudo obtener la ubicación",
      };
    }

    const distance = calculateDistance(driverLocation, pickupLocation);

    console.log(
      `📏 Distancia: ${Math.round(distance)}m (máximo: ${maxDistance}m)`,
    );

    const isNear = distance <= maxDistance;

    let message = "";
    if (distance > maxDistance * 2) {
      message = `🔴 Muy lejos (${Math.round(distance)}m)`;
    } else if (distance > maxDistance) {
      message = `🟡 Casi llego (${Math.round(distance)}m)`;
    } else {
      message = `🟢 Lo suficientemente cerca (${Math.round(distance)}m)`;
    }

    return {
      isNear,
      distance,
      message,
    };
  } catch (error) {
    console.error("❌ Error verificando cercanía:", error);
    return {
      isNear: false,
      distance: maxDistance + 1,
      message: "Error verificando ubicación",
    };
  }
};

/**
 * Escuchar cambios de ubicación en tiempo real
 * Si MOCK está activado, simula cambios de ubicación
 */
export const watchLocation = (
  callback: (location: Coordinates) => void,
  onError?: (error: string) => void,
): (() => void) => {
  if (USE_MOCK_LOCATION) {
    console.log("👁️ Monitoreando ubicación SIMULADA cada 3 segundos");

    // Simular cambios de ubicación cada 3 segundos
    const interval = setInterval(() => {
      const coords = getSimulatedCoordinates();
      console.log(`📍 Update MOCK: ${currentSimulation}`);
      callback(coords);
    }, 3000);

    return () => {
      clearInterval(interval);
      console.log("⏹️ Monitoreo de ubicación detenido");
    };
  }

  // GPS real
  const unsubscribe = Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 3000, // Actualizar cada 3 segundos
      distanceInterval: 15, // O cada 15 metros
    },
    (location) => {
      const coords: Coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      console.log(`📍 GPS Update: ${coords.latitude}, ${coords.longitude}`);
      callback(coords);
    },
  );

  return async () => {
    const subscription = await unsubscribe;
    subscription.remove();
  };
};

/**
 * Formatear distancia para mostrar al usuario
 */
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

/**
 * ============================================
 * FUNCIONES DE DEBUGGING PARA TESTING
 * ============================================
 */

/**
 * Simular el movimiento del conductor hacia el pasajero
 * Útil para testing interactivo
 */
export const simulateApproach = () => {
  const sequence: DriverSimulation[] = [
    DriverSimulation.VERY_FAR,
    DriverSimulation.FAR,
    DriverSimulation.CLOSE,
    DriverSimulation.VERY_CLOSE,
  ];

  let step = 0;

  console.log("🚗 Iniciando secuencia de aproximación...");

  const interval = setInterval(() => {
    if (step < sequence.length) {
      setSimulation(sequence[step]);
      console.log(`⏱️ Paso ${step + 1}/${sequence.length}: ${sequence[step]}`);
      step++;
    } else {
      clearInterval(interval);
      console.log("✅ Secuencia de aproximación completada");
    }
  }, 5000); // Cambiar cada 5 segundos

  return () => clearInterval(interval);
};

/**
 * Mostrar información de debugging
 */
export const getDebugInfo = (): string => {
  return `
🔧 DEBUGGING INFO:
- USE_MOCK_LOCATION: ${USE_MOCK_LOCATION}
- Current Simulation: ${currentSimulation}
- Coordinates: ${JSON.stringify(getSimulatedCoordinates())}

📝 Para cambiar simulación en consola:
  window.GeoDebug.setSimulation('${DriverSimulation.VERY_FAR}')
  window.GeoDebug.setSimulation('${DriverSimulation.FAR}')
  window.GeoDebug.setSimulation('${DriverSimulation.CLOSE}')
  window.GeoDebug.setSimulation('${DriverSimulation.VERY_CLOSE}')

🚗 Para simular aproximación automática:
  window.GeoDebug.simulateApproach()
`;
};

// Exponer funciones de debug globalmente (solo en desarrollo)
if (__DEV__) {
  (global as any).GeoDebug = {
    setSimulation,
    simulateApproach,
    getDebugInfo,
    getSimulatedCoordinates,
    DriverSimulation,
  };

  console.log(getDebugInfo());
}
