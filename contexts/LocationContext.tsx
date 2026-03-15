import * as Location from "expo-location";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

// Tipos
interface AddressData {
  street?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postalCode?: string | null;
}

interface LocationContextType {
  location: Location.LocationObject | null;
  address: AddressData | null;
  loading: boolean;
  error: string | null;
  getCurrentLocation: () => Promise<Location.LocationObject | null>;
  requestLocationPermission: () => Promise<boolean>;
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined,
);

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation debe ser usado dentro de un LocationProvider");
  }
  return context;
};

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({
  children,
}) => {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [address, setAddress] = useState<AddressData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setError("Permiso de ubicación denegado");
        console.log("❌ Permiso de ubicación denegado");
        return false;
      }

      console.log("✅ Permiso de ubicación concedido");
      return true;
    } catch (error) {
      console.error("Error solicitando permisos:", error);
      setError("Error solicitando permisos");
      return false;
    }
  };

  const getCurrentLocation =
    async (): Promise<Location.LocationObject | null> => {
      console.log("📍 Obteniendo ubicación actual...");
      setLoading(true);
      setError(null);

      try {
        // Verificar permisos
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          setLoading(false);
          return null;
        }

        // Obtener ubicación actual
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // Cambiado de High a Balanced para mejor rendimiento
        });

        console.log("✅ Ubicación obtenida:", {
          lat: currentLocation.coords.latitude,
          lng: currentLocation.coords.longitude,
        });

        setLocation(currentLocation);

        // Obtener dirección con reverse geocoding
        try {
          const addressData = await Location.reverseGeocodeAsync({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          });

          if (addressData.length > 0) {
            const addr = {
              street: addressData[0].street,
              city: addressData[0].city,
              region: addressData[0].region,
              country: addressData[0].country,
              postalCode: addressData[0].postalCode,
            };

            setAddress(addr);
            console.log("✅ Dirección obtenida:", addr);
          } else {
            console.log("⚠️ No se encontró dirección para estas coordenadas");
            setAddress({
              city: "Ubicación obtenida",
              region: null,
              street: null,
              country: null,
              postalCode: null,
            });
          }
        } catch (geocodeError) {
          console.error("Error obteniendo dirección:", geocodeError);
          // No establecer error, solo dejar la ubicación sin dirección
          setAddress({
            city: `${currentLocation.coords.latitude.toFixed(4)}, ${currentLocation.coords.longitude.toFixed(4)}`,
            region: null,
            street: null,
            country: null,
            postalCode: null,
          });
        }

        setLoading(false);
        return currentLocation;
      } catch (error) {
        console.error("❌ Error obteniendo ubicación:", error);
        setError("No se pudo obtener la ubicación");
        setLoading(false);
        return null;
      }
    };

  // ✅ Obtener ubicación automáticamente al iniciar
  useEffect(() => {
    async function initLocation() {
      // Verificar si ya tenemos permisos
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status === "granted") {
        // Si ya tenemos permisos, obtener ubicación automáticamente
        await getCurrentLocation();
      }
    }

    initLocation();
  }, []);

  const value: LocationContextType = {
    location,
    address,
    loading,
    error,
    getCurrentLocation,
    requestLocationPermission,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};
