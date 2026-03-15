/**
 * hooks/usePushNotifications.ts - YakooDriver
 */

import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { registerPushToken } from "../utils/pushNotifications";

export function usePushNotifications(collection: "users" | "drivers") {
  const { user }             = useAuth();
  const notificationListener = useRef<any>(null);
  const responseListener     = useRef<any>(null);

  useEffect(() => {
    if (!user?.uid) return;

    // Registrar token en Firestore
    registerPushToken(user.uid, collection);

    // Notificación recibida con app abierta
    notificationListener.current = Notifications.addNotificationReceivedListener(
      notification => {
        console.log("📬 Notificación recibida:", notification);
      }
    );

    // En YakooDriver no navegamos al tap — solo registramos
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      response => {
        console.log("👆 Notificación tocada:", response);
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user?.uid]);
}