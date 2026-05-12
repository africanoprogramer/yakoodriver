/**
 * app/(driver)/booking-trip.tsx
 *
 * Pantalla del viaje cuando un conductor acepta una reserva.
 * Estados: accepted → driver_arriving → in_progress → completed
 */

import { db, functions } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BRAND = "#F2AB30";

interface Booking {
  id: string;
  companyId: string;
  clientName: string;
  clientPhone: string;
  pickup: { address: string; lat?: number; lng?: number };
  dropoff: { address: string; lat?: number; lng?: number };
  scheduledTime: any;
  estimatedPrice: number;
  notes?: string;
  status: string;
}

const fmtTs = (ts: any) => {
  if (!ts) return "—";
  const d = ts.toDate?.() ?? new Date(ts);
  return d.toLocaleTimeString("es-GQ", { hour: "2-digit", minute: "2-digit" });
};

export default function BookingTripScreen() {
  const params = useLocalSearchParams<{ bookingId: string }>();
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [companyName, setCompanyName] = useState("Empresa");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!params.bookingId) return;
    const unsub = onSnapshot(
      doc(db, "ride_bookings", params.bookingId),
      async (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as Booking;
          setBooking(data);
          // Cargar nombre empresa
          if (data.companyId) {
            const cSnap = await import("firebase/firestore").then((m) =>
              m.getDoc(doc(db, "companies", data.companyId)),
            );
            if (cSnap.exists()) {
              setCompanyName(cSnap.data()?.name || "Empresa");
            }
          }
        }
      },
    );
    return unsub;
  }, [params.bookingId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!booking) return;
    setUpdating(true);
    try {
      const update = httpsCallable(functions, "updateBookingStatus");
      await update({ bookingId: booking.id, status: newStatus });
      if (newStatus === "completed") {
        Alert.alert(
          "🎉 Viaje completado",
          `Has cobrado ${booking.estimatedPrice?.toLocaleString(
            "es-GQ",
          )} XAF en efectivo del cliente.`,
          [{ text: "OK", onPress: () => router.replace("/(tabs)" as any) }],
        );
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "No se pudo actualizar");
    }
    setUpdating(false);
  };

  const handleCancel = () => {
    Alert.alert(
      "¿Cancelar reserva?",
      "Si cancelas, la reserva se liberará y otros conductores podrán aceptarla. Tu tasa de aceptación bajará.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: async () => {
            await handleStatusChange("cancelled");
            router.replace("/(tabs)" as any);
          },
        },
      ],
    );
  };

  if (!booking) {
    return (
      <SafeAreaView style={st.container} edges={["top"]}>
        <View style={st.center}>
          <ActivityIndicator size="large" color={BRAND} />
        </View>
      </SafeAreaView>
    );
  }

  const isAccepted = booking.status === "accepted";
  const isArriving = booking.status === "driver_arriving";
  const isInProgress = booking.status === "in_progress";

  return (
    <SafeAreaView style={st.container} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Badge empresa */}
        <View style={st.companyBadge}>
          <Ionicons name="business" size={14} color="#fff" />
          <Text style={st.companyBadgeTxt}>Reserva {companyName}</Text>
        </View>

        {/* Estado actual */}
        <View style={st.statusCard}>
          <Text style={st.statusLabel}>ESTADO ACTUAL</Text>
          <Text style={st.statusValue}>
            {isAccepted && "✅ Reserva aceptada"}
            {isArriving && "🚗 En camino al cliente"}
            {isInProgress && "🛣️ Viaje en curso"}
          </Text>
        </View>

        {/* Cliente */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>👤 Cliente</Text>
          <View style={st.clientCard}>
            <View style={st.clientAvatar}>
              <Text style={st.clientInitial}>
                {booking.clientName?.[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.clientName}>{booking.clientName}</Text>
              <Text style={st.clientPhone}>{booking.clientPhone}</Text>
            </View>
            <TouchableOpacity
              style={st.callBtn}
              onPress={() => Linking.openURL(`tel:${booking.clientPhone}`)}
            >
              <Ionicons name="call" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={st.waBtn}
              onPress={() =>
                Linking.openURL(
                  `https://wa.me/${booking.clientPhone.replace(/\D/g, "")}`,
                )
              }
            >
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hora */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>⏰ Hora de recogida</Text>
          <View style={st.timeCard}>
            <Ionicons name="time" size={20} color={BRAND} />
            <Text style={st.timeTxt}>{fmtTs(booking.scheduledTime)}</Text>
          </View>
        </View>

        {/* Direcciones */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>📍 Ruta</Text>
          <View style={st.routeBox}>
            <View style={st.routeRow}>
              <View style={[st.routeDot, { backgroundColor: "#10B981" }]} />
              <View style={{ flex: 1 }}>
                <Text style={st.routeLabel}>RECOGIDA</Text>
                <Text style={st.routeTxt}>{booking.pickup?.address}</Text>
              </View>
            </View>
            <View style={st.routeLine} />
            <View style={st.routeRow}>
              <View style={[st.routeDot, { backgroundColor: "#EF4444" }]} />
              <View style={{ flex: 1 }}>
                <Text style={st.routeLabel}>DESTINO</Text>
                <Text style={st.routeTxt}>{booking.dropoff?.address}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Notas */}
        {booking.notes && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>📝 Observaciones</Text>
            <View style={st.notesBox}>
              <Text style={st.notesTxt}>{booking.notes}</Text>
            </View>
          </View>
        )}

        {/* Precio */}
        <View style={st.priceCard}>
          <Text style={st.priceLabel}>COBRAR EN EFECTIVO</Text>
          <Text style={st.priceValue}>
            {booking.estimatedPrice?.toLocaleString("es-GQ")} XAF
          </Text>
        </View>

        {/* Botones de acción */}
        <View style={{ gap: 10 }}>
          {isAccepted && (
            <TouchableOpacity
              style={st.actionBtn}
              onPress={() => handleStatusChange("driver_arriving")}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="car" size={20} color="#fff" />
                  <Text style={st.actionBtnTxt}>Voy de camino</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isArriving && (
            <TouchableOpacity
              style={[st.actionBtn, { backgroundColor: "#8B5CF6" }]}
              onPress={() => handleStatusChange("in_progress")}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="play" size={20} color="#fff" />
                  <Text style={st.actionBtnTxt}>Recogí al cliente</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isInProgress && (
            <TouchableOpacity
              style={[st.actionBtn, { backgroundColor: "#10B981" }]}
              onPress={() => handleStatusChange("completed")}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={st.actionBtnTxt}>Completar viaje</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={st.cancelBtn} onPress={handleCancel}>
            <Text style={st.cancelBtnTxt}>Cancelar reserva</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  companyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#3B82F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  companyBadgeTxt: { fontSize: 12, fontWeight: "800", color: "#fff" },

  statusCard: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BRAND,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9CA3AF",
    letterSpacing: 1,
  },
  statusValue: { fontSize: 18, fontWeight: "800", color: "#fff", marginTop: 6 },

  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#9CA3AF",
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  clientCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1F2937",
    borderRadius: 14,
    padding: 12,
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND,
    justifyContent: "center",
    alignItems: "center",
  },
  clientInitial: { fontSize: 18, fontWeight: "800", color: "#fff" },
  clientName: { fontSize: 15, fontWeight: "700", color: "#fff" },
  clientPhone: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  waBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#25D366",
    justifyContent: "center",
    alignItems: "center",
  },

  timeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1F2937",
    borderRadius: 14,
    padding: 14,
  },
  timeTxt: { fontSize: 18, fontWeight: "800", color: "#fff" },

  routeBox: { backgroundColor: "#1F2937", borderRadius: 14, padding: 14 },
  routeRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  routeLine: {
    width: 2,
    height: 14,
    backgroundColor: "#374151",
    marginLeft: 4,
    marginVertical: 4,
  },
  routeLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#6B7280",
    letterSpacing: 0.5,
  },
  routeTxt: { fontSize: 14, fontWeight: "600", color: "#fff", marginTop: 2 },

  notesBox: { backgroundColor: "#1F2937", borderRadius: 14, padding: 14 },
  notesTxt: { fontSize: 13, color: "#E5E7EB", lineHeight: 20 },

  priceCard: {
    backgroundColor: "#064E3B",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginVertical: 16,
    borderWidth: 1,
    borderColor: "#10B981",
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10B981",
    letterSpacing: 1,
  },
  priceValue: { fontSize: 32, fontWeight: "900", color: "#fff", marginTop: 6 },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: BRAND,
    borderRadius: 14,
    paddingVertical: 16,
  },
  actionBtnTxt: { fontSize: 16, fontWeight: "800", color: "#fff" },

  cancelBtn: { paddingVertical: 12, alignItems: "center" },
  cancelBtnTxt: { fontSize: 13, fontWeight: "600", color: "#EF4444" },
});
