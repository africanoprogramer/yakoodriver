/**
 * utils/pushNotifications.ts
 *
 * Sistema de notificaciones push para Yakoo y YakooDriver.
 * Usa Expo Push Notifications + Firestore para guardar tokens.
 *
 * INSTALACIÓN (ejecutar en ambas apps):
 *   npx expo install expo-notifications expo-device expo-constants
 */

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { doc, updateDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { db } from "@/config/firebase";

// Configuración del comportamiento cuando llega una notificación con la app abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Registrar dispositivo y guardar token ─────────────────────────
export async function registerPushToken(
  uid: string,
  collection: "users" | "drivers"
): Promise<string | null> {
  // Solo funciona en dispositivo físico
  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device");
    return null;
  }

  // Pedir permiso
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("Push notification permission denied");
    return null;
  }

  // Configuración canal Android
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("yakoo", {
      name: "Yakoo",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#F2AB30",
      sound: "default",
    });
  }

  // Obtener token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const token     = tokenData.data;

  // Guardar en Firestore
  try {
    await updateDoc(doc(db, collection, uid), { pushToken: token });
  } catch (e) {
    console.error("Error saving push token:", e);
  }

  return token;
}

// ── Enviar notificación via Expo Push API ─────────────────────────
// Se llama desde el cliente (app del conductor) al cambiar estado del pedido.
// En producción esto debería ir a una Cloud Function, pero funciona desde cliente.
export async function sendPushNotification({
  token,
  title,
  body,
  data = {},
}: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}): Promise<void> {
  if (!token || !token.startsWith("ExponentPushToken")) return;

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept":       "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to:    token,
        title,
        body,
        data,
        sound:    "default",
        priority: "high",
        channelId: "yakoo",
      }),
    });
  } catch (e) {
    console.error("Error sending push notification:", e);
  }
}

// ── Mensajes predefinidos por evento ─────────────────────────────
export const PUSH_MESSAGES = {
  orderAccepted: (driverName: string) => ({
    title: "🏍️ Repartidor asignado",
    body:  `${driverName} ha aceptado tu pedido y se dirige a la tienda`,
  }),
  orderPickingUp: (driverName: string) => ({
    title: "🛒 Recogiendo tu pedido",
    body:  `${driverName} está preparando tus productos`,
  }),
  orderOnTheWay: (driverName: string) => ({
    title: "🚀 ¡Tu pedido está en camino!",
    body:  `${driverName} está de camino hacia ti. Prepárate para recibirlo`,
  }),
  orderDelivered: () => ({
    title: "✅ ¡Pedido entregado!",
    body:  "Tu pedido ha llegado. ¡Que lo disfrutes! 🎉",
  }),
  orderCancelled: () => ({
    title: "❌ Pedido cancelado",
    body:  "Tu pedido ha sido cancelado",
  }),
  newOrderForDriver: (address: string) => ({
    title: "📦 ¡Nuevo pedido disponible!",
    body:  `Entrega en: ${address}`,
  }),
};