import { db } from "@/config/firebase";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { doc, setDoc } from "firebase/firestore";
import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState,
} from "react";
import { Platform } from "react-native";
import { useAuth } from "./AuthContext";

// 🔔 Configurar cómo se muestran las notificaciones
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;

    // No mostrar notificación para actualizaciones en tiempo real
    if (
      data.tipo === "actualizacion_ubicacion" ||
      data.tipo === "mensaje_silencioso"
    ) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }

    // Mostrar notificación normal
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

// Tipos
interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  lastDataMessage: any;
  notificationPermission: string | null;
  requestPermission: () => Promise<boolean>;
  clearBadge: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications debe usarse dentro de NotificationProvider",
    );
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);
  const [lastDataMessage, setLastDataMessage] = useState<any>(null);
  const [notificationPermission, setNotificationPermission] = useState<
    string | null
  >(null);

  const { user } = useAuth();

  useEffect(() => {
    // Registrar para notificaciones push
    registerForPushNotificationsAsync().then((result) => {
      if (result) {
        setExpoPushToken(result.token);
        setNotificationPermission(result.permission);

        // Guardar token en Firestore
        if (user && result.token) {
          saveTokenToFirestore(user.uid, result.token);
        }
      }
    });

    // 📬 Listener: Notificación RECIBIDA (app en foreground)
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("📬 Notificación recibida:", notification);
        setNotification(notification);

        // Procesar data del mensaje
        const data = notification.request.content.data;
        handleDataMessage(data);
      },
    );

    // 👆 Listener: Usuario TOCÓ la notificación
    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("👆 Usuario tocó notificación");
        const data = response.notification.request.content.data;
        handleNotificationTap(data);
      });

    // Cleanup al desmontar
    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, [user]);

  // 🔄 Procesar mensajes de DATA (sin mostrar notificación)
  const handleDataMessage = (data: any) => {
    console.log("🔄 Procesando data message:", data);
    setLastDataMessage(data);

    // Acciones según tipo de mensaje
    switch (data.tipo) {
      case "actualizacion_ubicacion":
        console.log(
          "📍 Nueva ubicación del conductor:",
          data.latitude,
          data.longitude,
        );
        break;

      case "cambio_estado_viaje":
        console.log("🔄 Cambio de estado del viaje:", data.estado);
        break;

      case "nuevo_mensaje_chat":
        console.log("💬 Nuevo mensaje:", data.mensaje);
        break;

      case "precio_actualizado":
        console.log("💰 Precio actualizado:", data.precio);
        break;

      default:
        console.log("📦 Data message:", data);
    }
  };

  // 👆 Acciones cuando usuario toca la notificación
  const handleNotificationTap = (data: any) => {
    console.log("🔔 Procesando tap en notificación:", data);

    switch (data.tipo) {
      case "nuevo_viaje":
        console.log("🚗 Navegar a viaje:", data.viajeId);
        break;

      case "conductor_aceptado":
        console.log("✅ Navegar a viaje activo:", data.viajeId);
        break;

      case "viaje_completado":
        console.log("⭐ Navegar a calificar viaje:", data.viajeId);
        break;

      case "promocion":
        console.log("🎉 Navegar a promociones");
        break;

      default:
        console.log("🔔 Notificación sin acción específica");
    }
  };

  // Solicitar permisos de notificaciones
  const requestPermission = async (): Promise<boolean> => {
    const result = await registerForPushNotificationsAsync();
    if (result) {
      setExpoPushToken(result.token);
      setNotificationPermission(result.permission);

      if (user && result.token) {
        await saveTokenToFirestore(user.uid, result.token);
      }
      return result.permission === "granted";
    }
    return false;
  };

  // Limpiar badge de notificaciones
  const clearBadge = async (): Promise<void> => {
    await Notifications.setBadgeCountAsync(0);
  };

  const value: NotificationContextType = {
    expoPushToken,
    notification,
    lastDataMessage,
    notificationPermission,
    requestPermission,
    clearBadge,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// 🔧 FUNCIONES AUXILIARES

// Registrar dispositivo para notificaciones push
async function registerForPushNotificationsAsync() {
  let token: string | undefined;
  let permission: string = "undetermined";

  // Configurar canal de notificaciones en Android
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#ee9b2f",
      sound: "default",
      enableVibrate: true,
      showBadge: true,
    });
  }

  // Verificar que sea dispositivo real
  if (Device.isDevice) {
    // Verificar permisos existentes
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Si no tiene permisos, solicitarlos
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    permission = finalStatus;

    // Si no se concedieron permisos
    if (finalStatus !== "granted") {
      console.log("❌ Permiso de notificaciones denegado");
      return { token: null, permission: finalStatus };
    }

    // Obtener el token de Expo Push
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      token = tokenData.data;
      console.log("🔔 Token de notificaciones obtenido:", token);
    } catch (error) {
      console.error("❌ Error obteniendo token:", error);
    }
  } else {
    console.log("⚠️ Debes usar un dispositivo físico para notificaciones push");
  }

  return { token, permission };
}

// Guardar token en Firestore
async function saveTokenToFirestore(userId: string, token: string) {
  try {
    await setDoc(
      doc(db, "users", userId),
      {
        pushToken: token,
        pushTokenUpdatedAt: new Date().toISOString(),
        platform: Platform.OS,
        deviceType: Device.deviceName || "unknown",
      },
      { merge: true },
    );
    console.log("✅ Token guardado en Firestore");
  } catch (error) {
    console.error("❌ Error guardando token:", error);
  }
}

// 📤 FUNCIONES PARA ENVIAR NOTIFICACIONES LOCALES (opcional)

// Enviar notificación local inmediata
export async function enviarNotificacionLocal(
  titulo: string,
  mensaje: string,
  data?: any,
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: titulo,
      body: mensaje,
      data: data || {},
      sound: "default",
    },
    trigger: null, // null = enviar inmediatamente
  });
}

// Programar notificación local
export async function programarNotificacionLocal(
  titulo: string,
  mensaje: string,
  segundos: number,
  data?: any,
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: titulo,
      body: mensaje,
      data: data || {},
      sound: "default",
    },
    trigger: { seconds: segundos },
  });
}

// Cancelar todas las notificaciones programadas
export async function cancelarTodasLasNotificaciones() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Obtener notificaciones programadas
export async function obtenerNotificacionesProgramadas() {
  return await Notifications.getAllScheduledNotificationsAsync();
}
