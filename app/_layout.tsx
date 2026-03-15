import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import "react-native-reanimated";

// Importar Contexts
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { usePushNotifications } from "../hooks/usePushNotifications";

// Importar Splash Screen
import SplashScreen from "@/components/SplashScreen";

export const unstable_settings = {
  anchor: "(driver)",
};

/**
 * Componente de navegación protegida para YakooDriver
 *
 * En YakooDriver SOLO hay conductores, no hay usuarios pasajeros
 *
 * Flujos:
 * 1. No autenticado → (driver-auth)/onboarding
 * 2. Autenticado pero NO verificado → (driver)/pending-verification
 * 3. Autenticado y VERIFICADO → (driver)/home
 */
function NavigationContent() {
  usePushNotifications("drivers");
  const { user, loading, isDriverVerified } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    console.log("🔍 Nav check:", {
      user: !!user,
      isDriverVerified,
      segment: segments[0],
    });

    if (!user) {
      if (!inAuthGroup) {
        router.replace("/(auth)/onboarding");
      }
      return;
    }

    if (user && !isDriverVerified) {
      if (segments[1] !== "verification-pending") {
        router.replace("/(auth)/verification-pending");
      }
      return;
    }

    if (user && isDriverVerified) {
      if (inAuthGroup) {
        router.replace("/(tabs)");
      }
    }
  }, [user, loading, isDriverVerified]); // ← Sin el ref, reacciona a cada cambio

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(driver)" />
    </Stack>
  );
}

/**
 * Componente que envuelve la navegación con el tema
 */
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { loading } = useAuth();

  // Mostrar Splash mientras verifica autenticación
  if (loading) {
    return <SplashScreen />;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <NavigationContent />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

/**
 * Layout principal con todos los providers
 * YakooDriver - App de Conductores
 */
export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Mostrar Splash Screen inicial (2.5 segundos)
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  // Mostrar Splash mientras carga la app
  if (!isReady) {
    return <SplashScreen />;
  }

  return (
    <AuthProvider>
      <CartProvider>
        <LocationProvider>
          <NotificationProvider>
            <RootLayoutNav />
          </NotificationProvider>
        </LocationProvider>
      </CartProvider>
    </AuthProvider>
  );
}
