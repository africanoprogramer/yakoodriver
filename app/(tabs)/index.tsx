import { RideNotificationModal } from "@/components/RideNotificationModal";
import { db } from "@/config/firebase";
import { useAuth, useDriverData } from "@/contexts/AuthContext";
import { updateDriverOnlineStatus } from "@/utils/driverStatusService";
import {
  acceptRideNotification,
  listenToRideNotifications,
  rejectRideNotification,
} from "@/utils/rideNotificationsListener";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

interface RideNotification {
  rideId: string;
  userId: string;
  userEmail: string;
  userPhone?: string;
  pickup: { name: string; address: string; lat: number; lng: number };
  destination: { name: string; address: string; lat: number; lng: number };
  vehicleType: string;
  distance: number;
  estimatedPrice: number;
  notificationStatus?: "pending" | "accepted" | "rejected" | "expired";
  createdAt: any;
}

interface AppNotification {
  id: string;
  type: "ride" | "earning" | "system" | "verification";
  title: string;
  body: string;
  read: boolean;
  createdAt: any;
}

// ── Notifications Panel ──────────────────────────────────────────
function NotificationsPanel({
  visible,
  onClose,
  driverId,
}: {
  visible: boolean;
  onClose: () => void;
  driverId: string;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const slideAnim = useRef(new Animated.Value(-400)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : -400,
      useNativeDriver: true,
      tension: visible ? 80 : 200,
      friction: visible ? 10 : 20,
    }).start();
  }, [visible]);

  useEffect(() => {
    if (!driverId || !visible) return;
    const q = query(
      collection(db, "drivers", driverId, "notifications"),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(q, (snap) => {
      setNotifications(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification),
      );
    });
  }, [driverId, visible]);

  const ICON: Record<string, { name: string; color: string; bg: string }> = {
    ride: { name: "car", color: "#F2AB30", bg: "#2D2010" },
    earning: { name: "cash", color: "#10B981", bg: "#064E3B" },
    system: { name: "information-circle", color: "#3B82F6", bg: "#1E2A4A" },
    verification: { name: "shield-checkmark", color: "#8B5CF6", bg: "#2D1B4A" },
  };

  const fmt = (ts: any) => {
    if (!ts?.toDate) return "";
    const diff = Math.floor((Date.now() - ts.toDate().getTime()) / 60000);
    if (diff < 1) return "Ahora";
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}d`;
  };

  if (!visible) return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={panel.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[panel.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={panel.handle} />
        <View style={panel.header}>
          <Text style={panel.title}>Notificaciones</Text>
          {notifications.filter((n) => !n.read).length > 0 && (
            <View style={panel.badge}>
              <Text style={panel.badgeTxt}>
                {notifications.filter((n) => !n.read).length}
              </Text>
            </View>
          )}
          <TouchableOpacity style={panel.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {notifications.length === 0 ? (
            <View style={panel.empty}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🔔</Text>
              <Text style={panel.emptyTitle}>Sin notificaciones</Text>
              <Text style={panel.emptySub}>
                Aquí aparecerán tus viajes, ganancias y avisos.
              </Text>
            </View>
          ) : (
            notifications.map((n) => {
              const ico = ICON[n.type] ?? ICON.system;
              return (
                <View key={n.id} style={[panel.item, !n.read && panel.itemUnread]}>
                  <View style={[panel.itemIcon, { backgroundColor: ico.bg }]}>
                    <Ionicons name={ico.name as any} size={18} color={ico.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={panel.itemTop}>
                      <Text style={panel.itemTitle} numberOfLines={1}>{n.title}</Text>
                      <Text style={panel.itemTime}>{fmt(n.createdAt)}</Text>
                    </View>
                    <Text style={panel.itemBody} numberOfLines={2}>{n.body}</Text>
                  </View>
                  {!n.read && <View style={panel.dot} />}
                </View>
              );
            })
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════════
export default function HomeTab() {
  const driverData = useDriverData();
  const { user } = useAuth();

  const [isOnline, setIsOnline] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [tripsCompleted, setTripsCompleted] = useState(0);
  const [rating, setRating] = useState(4.95);
  const [acceptance, setAcceptance] = useState(98);
  const [updating, setUpdating] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [pendingBookings, setPendingBookings] = useState(0);

  const [currentNotification, setCurrentNotification] = useState<RideNotification | null>(null);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [unsubscribeRides, setUnsubscribeRides] = useState<(() => void) | null>(null);

  const currentRideIdRef = useRef<string | null>(null);
  const modalVisibleRef = useRef(false);
  const markDriverActionRef = useRef<((rideId: string) => void) | null>(null);
  const acceptingRef = useRef(false);

  const profilePicture = driverData?.profilePicture;

  useEffect(() => {
    modalVisibleRef.current = notificationVisible;
  }, [notificationVisible]);

  // ── Datos conductor ──
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "drivers", user.uid), (snap) => {
      const data = snap.data();
      if (!data) return;
      setTotalEarnings(data.totalEarnings || 0);
      setTripsCompleted(data.totalTrips || 0);
      setRating(data.rating || 4.95);
      setAcceptance(data.acceptanceRate || 98);
      if (data.isOnline !== undefined) setIsOnline(data.isOnline);
    });
  }, [user]);

  // ── Badge no leídas ──
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(
        collection(db, "drivers", user.uid, "notifications"),
        where("read", "==", false),
      ),
      (snap) => setUnreadCount(snap.size),
    );
  }, [user]);

  // ── Reservas pendientes ──
  useEffect(() => {
    if (!user || !isOnline) {
      setPendingBookings(0);
      return;
    }
    return onSnapshot(
      query(collection(db, "ride_bookings"), where("status", "==", "pending")),
      (snap) => setPendingBookings(snap.size),
    );
  }, [user, isOnline]);

  // ── Ride notifications listener ──
  useEffect(() => {
    if (!user || !isOnline) {
      unsubscribeRides?.();
      setUnsubscribeRides(null);
      return;
    }

    const { unsubscribe: unsub, markDriverAction } = listenToRideNotifications(
      user.uid,
      (notification) => {
        currentRideIdRef.current = notification.rideId;
        setCurrentNotification(notification);
        setNotificationVisible(true);
      },
      undefined,
      async (removedRideId) => {
        if (currentRideIdRef.current !== removedRideId || !modalVisibleRef.current) return;
        try {
          const rideSnap = await getDoc(doc(db, "rides", removedRideId));
          const rideData = rideSnap.data();
          if (!rideData) return;
          if (rideData.status === "cancelled" || rideData.status === "expired") {
            currentRideIdRef.current = null;
            setNotificationVisible(false);
            setCurrentNotification(null);
            Alert.alert("Solicitud cancelada", "El pasajero canceló la solicitud o el tiempo expiró.");
          }
        } catch (error) {
          console.error("Error verificando ride:", error);
        }
      },
    );

    markDriverActionRef.current = markDriverAction;
    setUnsubscribeRides(() => unsub);
    return () => unsub();
  }, [user, isOnline]);

  // ── Toggle online ──
  const handleOnlineStatusChange = async (newStatus: boolean) => {
    if (!user) return;
    setUpdating(true);
    try {
      const result = await updateDriverOnlineStatus(user.uid, newStatus);
      if (result.success) {
        setIsOnline(newStatus);
        if (!newStatus) {
          unsubscribeRides?.();
          setUnsubscribeRides(null);
          setNotificationVisible(false);
          setCurrentNotification(null);
          currentRideIdRef.current = null;
        }
      } else Alert.alert("Error", result.error || "Error actualizando estado");
    } catch {
      Alert.alert("Error", "No se pudo actualizar");
    } finally {
      setUpdating(false);
    }
  };

  // ── Accept ──
  const handleAcceptRide = async (notification: RideNotification) => {
    if (!user || !driverData || acceptingRef.current) return;
    acceptingRef.current = true;
    markDriverActionRef.current?.(notification.rideId);
    currentRideIdRef.current = null;
    setNotificationVisible(false);
    setCurrentNotification(null);
    router.replace({
      pathname: "/(driver)/driver-trip-in-progress",
      params: {
        rideId: notification.rideId,
        pickup: JSON.stringify(notification.pickup),
        destination: JSON.stringify(notification.destination),
        distance: notification.distance.toString(),
        fare: notification.estimatedPrice.toString(),
      },
    });
    acceptRideNotification(user.uid, notification.rideId, driverData)
      .catch((e) => console.error("Error accept:", e))
      .finally(() => { acceptingRef.current = false; });
  };

  // ── Reject ──
  const handleRejectRide = async (notification: RideNotification) => {
    if (!user) return;
    markDriverActionRef.current?.(notification.rideId);
    currentRideIdRef.current = null;
    setNotificationVisible(false);
    setCurrentNotification(null);
    await rejectRideNotification(user.uid, notification.rideId);
  };

  return (
    <SafeAreaView style={st.container} edges={["top"]}>
      <RideNotificationModal
        visible={notificationVisible}
        notification={currentNotification}
        onAccept={handleAcceptRide}
        onReject={handleRejectRide}
      />
      <NotificationsPanel
        visible={showNotifs}
        onClose={() => setShowNotifs(false)}
        driverId={user?.uid ?? ""}
      />

      {/* ── HEADER ── */}
      <View style={st.header}>
        <TouchableOpacity
          style={st.avatarBtn}
          onPress={() => router.push("/(tabs)/profile")}
        >
          {profilePicture ? (
            <Image source={{ uri: profilePicture }} style={st.avatar} />
          ) : (
            <View style={[st.avatar, st.avatarFallback]}>
              <Ionicons name="person" size={22} color="#fff" />
            </View>
          )}
          <View
            style={[
              st.onlineDot,
              { backgroundColor: isOnline ? "#10B981" : "#6B7280" },
            ]}
          />
        </TouchableOpacity>

        <View style={st.headerMid}>
          <Text style={st.headerTitle}>Yakoo Driver</Text>
          <View style={st.statusRow}>
            <View
              style={[
                st.statusDot,
                { backgroundColor: isOnline ? "#10B981" : "#6B7280" },
              ]}
            />
            <Text style={[st.statusTxt, { color: isOnline ? "#10B981" : "#6B7280" }]}>
              {isOnline ? "ONLINE" : "OFFLINE"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={st.bellBtn}
          onPress={() => setShowNotifs(true)}
        >
          <Ionicons name="notifications" size={22} color="#fff" />
          {unreadCount > 0 && (
            <View style={st.bellBadge}>
              <Text style={st.bellBadgeTxt}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── MAPA ── */}
      <View style={st.mapBox}>
        <MapView
          style={st.map}
          initialRegion={{
            latitude: 3.7504,
            longitude: 8.7371,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation
          showsMyLocationButton
        />
      </View>

      {/* ── PANEL INFERIOR ── */}
      <ScrollView
        style={st.panel}
        contentContainerStyle={st.panelContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Toggle Online */}
        <TouchableOpacity
          style={[st.toggleBtn, isOnline ? st.toggleBtnOnline : st.toggleBtnOffline]}
          onPress={() => handleOnlineStatusChange(!isOnline)}
          disabled={updating}
          activeOpacity={0.85}
        >
          <View style={st.toggleInner}>
            <View style={[st.toggleCircle, isOnline ? st.toggleCircleOn : st.toggleCircleOff]}>
              <Ionicons
                name={isOnline ? "radio-button-on" : "radio-button-off"}
                size={22}
                color={isOnline ? "#111827" : "#fff"}
              />
            </View>
            <View>
              <Text style={[st.toggleLabel, isOnline && st.toggleLabelOn]}>
                {updating ? "Actualizando..." : isOnline ? "Estás online" : "Estás offline"}
              </Text>
              <Text style={st.toggleSub}>
                {isOnline ? "Recibiendo solicitudes de viaje" : "Toca para empezar a trabajar"}
              </Text>
            </View>
          </View>
          <Ionicons
            name={isOnline ? "power" : "power-outline"}
            size={28}
            color={isOnline ? "#111827" : "#6B7280"}
          />
        </TouchableOpacity>

        {/* ── Stats ── */}
        <View style={st.statsRow}>
          <View style={st.statCard}>
            <Ionicons name="cash" size={20} color="#10B981" />
            <Text style={st.statVal}>
              {totalEarnings >= 1000
                ? `${(totalEarnings / 1000).toFixed(1)}K`
                : totalEarnings.toLocaleString("es-GQ")}
            </Text>
            <Text style={st.statLbl}>XAF ganados</Text>
          </View>
          <View style={st.statCard}>
            <Ionicons name="car" size={20} color="#3B82F6" />
            <Text style={st.statVal}>{tripsCompleted}</Text>
            <Text style={st.statLbl}>Viajes</Text>
          </View>
          <View style={st.statCard}>
            <Ionicons name="star" size={20} color="#FBBF24" />
            <Text style={st.statVal}>{rating.toFixed(1)}</Text>
            <Text style={st.statLbl}>Valoración</Text>
          </View>
          <View style={st.statCard}>
            <Ionicons name="checkmark-circle" size={20} color="#FF6B35" />
            <Text style={st.statVal}>{acceptance}%</Text>
            <Text style={st.statLbl}>Aceptación</Text>
          </View>
        </View>

        {/* ── Servicios ── */}
        <Text style={st.sectionTitle}>Servicios</Text>
        <View style={st.servicesGrid}>
          <TouchableOpacity
            style={[st.serviceCard, st.serviceBlue]}
            onPress={() => router.push("/(driver)/reservations" as any)}
          >
            <View style={st.serviceIconBox}>
              <Ionicons name="calendar" size={24} color="#fff" />
            </View>
            <Text style={st.serviceLabel}>Reservas</Text>
            {pendingBookings > 0 && (
              <View style={st.serviceBadge}>
                <Text style={st.serviceBadgeTxt}>{pendingBookings}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[st.serviceCard, st.serviceGreen]}
            onPress={() => router.push("/(driver)/supermarket-orders")}
          >
            <View style={st.serviceIconBox}>
              <Ionicons name="storefront" size={24} color="#fff" />
            </View>
            <Text style={st.serviceLabel}>Supermercados</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[st.serviceCard, st.serviceOrange]}
            onPress={() => router.push("/(driver)/restaurant-orders")}
          >
            <View style={st.serviceIconBox}>
              <Ionicons name="restaurant" size={24} color="#fff" />
            </View>
            <Text style={st.serviceLabel}>Restaurantes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[st.serviceCard, st.servicePurple]}
            onPress={() => router.push("/(tabs)/pedidos")}
          >
            <View style={st.serviceIconBox}>
              <Ionicons name="cube" size={24} color="#fff" />
            </View>
            <Text style={st.serviceLabel}>Mis pedidos</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Panel styles ──────────────────────────────────────────────────
const panel = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#111827",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    maxHeight: "75%",
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#374151",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: "800", color: "#fff", flex: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    backgroundColor: "#F2AB30",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeTxt: { fontSize: 11, fontWeight: "800", color: "#1F2937" },
  item: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
    alignItems: "flex-start",
  },
  itemUnread: { backgroundColor: "#1A1F2E" },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  itemTitle: { fontSize: 14, fontWeight: "700", color: "#fff", flex: 1 },
  itemTime: { fontSize: 11, color: "#6B7280", marginLeft: 8 },
  itemBody: { fontSize: 13, color: "#9CA3AF", lineHeight: 18 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F2AB30",
    flexShrink: 0,
    marginTop: 4,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
});

// ── Main screen styles ────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
    gap: 12,
  },
  avatarBtn: { position: "relative" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#FF6B35",
  },
  avatarFallback: {
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#111827",
  },
  headerMid: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  bellBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  bellBadgeTxt: { fontSize: 9, fontWeight: "800", color: "#fff" },

  // Map
  mapBox: { height: 220 },
  map: { flex: 1 },

  // Bottom panel
  panel: { flex: 1, backgroundColor: "#111827" },
  panelContent: { padding: 16, gap: 16 },

  // Toggle
  toggleBtn: {
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
  },
  toggleBtnOnline: {
    backgroundColor: "#F2AB30",
    borderColor: "#F2AB30",
  },
  toggleBtnOffline: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  toggleInner: { flexDirection: "row", alignItems: "center", gap: 14 },
  toggleCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  toggleCircleOn: { backgroundColor: "#fff" },
  toggleCircleOff: { backgroundColor: "#374151" },
  toggleLabel: { fontSize: 16, fontWeight: "800", color: "#6B7280" },
  toggleLabelOn: { color: "#111827" },
  toggleSub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  // Stats
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: "#1F2937",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statVal: { fontSize: 16, fontWeight: "800", color: "#fff", textAlign: "center" },
  statLbl: { fontSize: 10, color: "#6B7280", fontWeight: "600", textAlign: "center" },

  // Services
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
    marginBottom: -4,
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  serviceCard: {
    width: "47%",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    position: "relative",
  },
  serviceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  serviceLabel: { fontSize: 14, fontWeight: "700", color: "#fff" },
  serviceBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  serviceBadgeTxt: { fontSize: 11, fontWeight: "800", color: "#fff" },
  serviceBlue: { backgroundColor: "#1D4ED8" },
  serviceGreen: { backgroundColor: "#15803D" },
  serviceOrange: { backgroundColor: "#EA580C" },
  servicePurple: { backgroundColor: "#7C3AED" },
});
