/**
 * app/(driver)/reservations.tsx
 *
 * Lista de reservas pendientes que cualquier conductor libre puede aceptar.
 * Filtra por status="pending" y muestra el badge "Reserva [Empresa]".
 */

import { db, functions } from "@/config/firebase";
import { useAuth, useDriverData } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BRAND = "#F2AB30";
const DARK = "#1F2937";

interface Booking {
  id: string;
  companyId: string;
  clientName: string;
  clientPhone: string;
  pickup: { address: string };
  dropoff: { address: string };
  scheduledTime: any;
  estimatedPrice: number;
  notes?: string;
  status: string;
  createdAt: any;
}

const fmtTs = (ts: any) => {
  if (!ts) return "—";
  const d = ts.toDate?.() ?? new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const time = d.toLocaleTimeString("es-GQ", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return `Hoy a las ${time}`;
  if (isTomorrow) return `Mañana a las ${time}`;
  return d.toLocaleDateString("es-GQ", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function ReservationsScreen() {
  const { user } = useAuth();
  const driverData = useDriverData();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  const hasActiveTrip = !!(
    driverData?.currentRideId || driverData?.currentBookingId
  );

  console.log("🔍 driverData:", {
    currentRideId: driverData?.currentRideId,
    currentBookingId: driverData?.currentBookingId,
    hasActiveTrip,
  });

  // Cargar reservas pendientes
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(
      query(
        collection(db, "ride_bookings"),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc"),
      ),
      async (snap) => {
        const list = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Booking,
        );
        setBookings(list);

        // Cargar nombres de empresas únicas
        const uniqueCompanyIds = [...new Set(list.map((b) => b.companyId))];
        const newNames: Record<string, string> = { ...companyNames };
        for (const cId of uniqueCompanyIds) {
          if (!newNames[cId]) {
            try {
              const cSnap = await import("firebase/firestore").then((m) =>
                m.getDoc(doc(db, "companies", cId)),
              );
              if (cSnap.exists()) {
                newNames[cId] = cSnap.data()?.name || "Empresa";
              }
            } catch {}
          }
        }
        setCompanyNames(newNames);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [user]);

  const handleAccept = async (booking: Booking) => {
    if (hasActiveTrip) {
      Alert.alert(
        "Ya tienes un viaje activo",
        "Termina tu viaje actual antes de aceptar otra reserva.",
      );
      return;
    }

    Alert.alert(
      "Aceptar reserva",
      `¿Aceptas el viaje de ${booking.clientName} para ${fmtTs(
        booking.scheduledTime,
      )}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Aceptar",
          onPress: async () => {
            setAccepting(booking.id);
            try {
              const acceptBooking = httpsCallable(functions, "acceptBooking");
              await acceptBooking({ bookingId: booking.id });
              router.replace({
                pathname: "/(driver)/booking-trip" as any,
                params: { bookingId: booking.id },
              });
            } catch (err: any) {
              Alert.alert(
                "Error",
                err?.message || "No se pudo aceptar la reserva.",
              );
            }
            setAccepting(null);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={st.container} edges={["top"]}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>📅 Reservas disponibles</Text>
          <Text style={st.headerSub}>
            {bookings.length} reserva{bookings.length !== 1 ? "s" : ""}{" "}
            pendiente{bookings.length !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {hasActiveTrip && (
        <View style={st.warningBanner}>
          <Ionicons name="warning" size={16} color="#F59E0B" />
          <Text style={st.warningTxt}>
            Tienes un viaje activo. Termínalo antes de aceptar reservas.
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={loading} tintColor={BRAND} />
        }
      >
        {loading ? (
          <View style={st.center}>
            <ActivityIndicator size="large" color={BRAND} />
          </View>
        ) : bookings.length === 0 ? (
          <View style={st.empty}>
            <Text style={{ fontSize: 56 }}>📅</Text>
            <Text style={st.emptyTitle}>Sin reservas disponibles</Text>
            <Text style={st.emptySub}>
              Cuando una empresa cree una reserva, aparecerá aquí.
            </Text>
          </View>
        ) : (
          bookings.map((b) => {
            const companyName = companyNames[b.companyId] || "Empresa";
            const isAccepting = accepting === b.id;

            return (
              <View key={b.id} style={st.card}>
                {/* Badge empresa */}
                <View style={st.companyBadge}>
                  <Ionicons name="business" size={12} color="#fff" />
                  <Text style={st.companyBadgeTxt}>Reserva {companyName}</Text>
                </View>

                {/* Cliente */}
                <View style={st.clientRow}>
                  <View style={st.clientAvatar}>
                    <Text style={st.clientInitial}>
                      {b.clientName?.[0]?.toUpperCase() || "?"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.clientName}>{b.clientName}</Text>
                    <Text style={st.clientPhone}>{b.clientPhone}</Text>
                  </View>
                  <View style={st.priceBox}>
                    <Text style={st.priceTxt}>
                      {b.estimatedPrice?.toLocaleString("es-GQ")}
                    </Text>
                    <Text style={st.priceCurrency}>XAF</Text>
                  </View>
                </View>

                {/* Hora */}
                <View style={st.timeRow}>
                  <Ionicons name="time-outline" size={14} color="#F59E0B" />
                  <Text style={st.timeTxt}>{fmtTs(b.scheduledTime)}</Text>
                </View>

                {/* Direcciones */}
                <View style={st.routeBox}>
                  <View style={st.routeRow}>
                    <View
                      style={[st.routeDot, { backgroundColor: "#10B981" }]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={st.routeLabel}>RECOGIDA</Text>
                      <Text style={st.routeTxt} numberOfLines={2}>
                        {b.pickup?.address}
                      </Text>
                    </View>
                  </View>
                  <View style={st.routeLine} />
                  <View style={st.routeRow}>
                    <View
                      style={[st.routeDot, { backgroundColor: "#EF4444" }]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={st.routeLabel}>DESTINO</Text>
                      <Text style={st.routeTxt} numberOfLines={2}>
                        {b.dropoff?.address}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Notas */}
                {b.notes ? (
                  <View style={st.notesBox}>
                    <Ionicons
                      name="document-text-outline"
                      size={12}
                      color="#9CA3AF"
                    />
                    <Text style={st.notesTxt} numberOfLines={2}>
                      {b.notes}
                    </Text>
                  </View>
                ) : null}

                {/* Botón aceptar */}
                <TouchableOpacity
                  style={[
                    st.acceptBtn,
                    (isAccepting || hasActiveTrip) && { opacity: 0.5 },
                  ]}
                  onPress={() => handleAccept(b)}
                  disabled={isAccepting || hasActiveTrip}
                >
                  {isAccepting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#fff"
                      />
                      <Text style={st.acceptBtnTxt}>Aceptar reserva</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#1F2937",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#451A03",
    borderBottomWidth: 1,
    borderBottomColor: "#78350F",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  warningTxt: { flex: 1, fontSize: 12, color: "#FBBF24", fontWeight: "500" },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  emptySub: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 20,
  },

  card: {
    backgroundColor: "#1F2937",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#374151",
    gap: 12,
  },

  companyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#3B82F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  companyBadgeTxt: { fontSize: 11, fontWeight: "800", color: "#fff" },

  clientRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  clientAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BRAND,
    justifyContent: "center",
    alignItems: "center",
  },
  clientInitial: { fontSize: 18, fontWeight: "800", color: "#fff" },
  clientName: { fontSize: 15, fontWeight: "700", color: "#fff" },
  clientPhone: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  priceBox: { alignItems: "flex-end" },
  priceTxt: { fontSize: 20, fontWeight: "900", color: BRAND },
  priceCurrency: { fontSize: 11, fontWeight: "600", color: "#9CA3AF" },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#451A03",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  timeTxt: { fontSize: 13, fontWeight: "700", color: "#FBBF24" },

  routeBox: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  routeRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  routeLine: {
    width: 2,
    height: 14,
    backgroundColor: "#374151",
    marginLeft: 4,
  },
  routeLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#6B7280",
    letterSpacing: 0.5,
  },
  routeTxt: { fontSize: 13, fontWeight: "600", color: "#E5E7EB", marginTop: 2 },

  notesBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#111827",
    padding: 10,
    borderRadius: 10,
  },
  notesTxt: { flex: 1, fontSize: 12, color: "#9CA3AF" },

  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    borderRadius: 14,
    paddingVertical: 14,
  },
  acceptBtnTxt: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
