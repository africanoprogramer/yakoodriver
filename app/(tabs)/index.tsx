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

// ── Types ──────────────────────────────────────────────────────
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
  notificationStatus: "pending" | "accepted" | "rejected";
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

// ── Notifications Panel ─────────────────────────────────────────
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
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -400,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!driverId || !visible) return;
    const q = query(
      collection(db, "drivers", driverId, "notifications"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification),
      );
    });
    return unsub;
  }, [driverId, visible]);

  const ICON: Record<string, { name: string; color: string; bg: string }> = {
    ride: { name: "car", color: "#F2AB30", bg: "#2D2010" },
    earning: { name: "cash", color: "#10B981", bg: "#064E3B" },
    system: { name: "information-circle", color: "#3B82F6", bg: "#1E2A4A" },
    verification: { name: "shield-checkmark", color: "#8B5CF6", bg: "#2D1B4A" },
  };

  const fmt = (ts: any) => {
    if (!ts?.toDate) return "";
    const d = ts.toDate();
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
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
      <TouchableOpacity
        style={st.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View
        style={[st.panel, { transform: [{ translateY: slideAnim }] }]}
      >
        <View style={st.panelHandle} />
        <View style={st.panelHeader}>
          <Text style={st.panelTitle}>Notificaciones</Text>
          {notifications.filter((n) => !n.read).length > 0 && (
            <View style={st.unreadBadge}>
              <Text style={st.unreadBadgeTxt}>
                {notifications.filter((n) => !n.read).length}
              </Text>
            </View>
          )}
          <TouchableOpacity style={st.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {notifications.length === 0 ? (
            <View style={st.emptyPanel}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🔔</Text>
              <Text style={st.emptyPanelTitle}>Sin notificaciones</Text>
              <Text style={st.emptyPanelSub}>
                Aquí aparecerán tus viajes, ganancias y avisos del sistema.
              </Text>
            </View>
          ) : (
            notifications.map((n) => {
              const ico = ICON[n.type] ?? ICON.system;
              return (
                <View
                  key={n.id}
                  style={[st.notifItem, !n.read && st.notifItemUnread]}
                >
                  <View style={[st.notifIcon, { backgroundColor: ico.bg }]}>
                    <Ionicons
                      name={ico.name as any}
                      size={18}
                      color={ico.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={st.notifTop}>
                      <Text style={st.notifTitle} numberOfLines={1}>
                        {n.title}
                      </Text>
                      <Text style={st.notifTime}>{fmt(n.createdAt)}</Text>
                    </View>
                    <Text style={st.notifBody} numberOfLines={2}>
                      {n.body}
                    </Text>
                  </View>
                  {!n.read && <View style={st.unreadDot} />}
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

  // Ride notifications
  const [currentNotification, setCurrentNotification] =
    useState<RideNotification | null>(null);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [unsubscribeRides, setUnsubscribeRides] = useState<(() => void) | null>(
    null,
  );

  // Ref para el rideId actual (evita stale closures)
  const currentRideIdRef = useRef<string | null>(null);

  const [earningsAnim] = useState(new Animated.Value(0));

  const profilePicture = driverData?.profilePicture;

  // ── Datos del conductor en tiempo real ──
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "drivers", user.uid), (snap) => {
      const data = snap.data();
      if (!data) return;
      setTotalEarnings(data.totalEarnings || 0);
      setTripsCompleted(data.totalTrips || 0);
      setRating(data.rating || 4.95);
      setAcceptance(data.acceptanceRate || 98);
      if (data.isOnline !== undefined) setIsOnline(data.isOnline);

      Animated.sequence([
        Animated.timing(earningsAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(earningsAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    });
    return unsub;
  }, [user]);

  // ── Badge notificaciones no leídas ──
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "drivers", user.uid, "notifications"),
      where("read", "==", false),
    );
    const unsub = onSnapshot(q, (snap) => setUnreadCount(snap.size));
    return unsub;
  }, [user]);

  // ── ESCUCHAR RIDE NOTIFICATIONS ──
  // El truco: cuando el pasajero cancela/expira, actualiza notificationStatus a "expired"
  // → Firestore onSnapshot detecta que el doc ya NO cumple el filtro (pending)
  // → dispara change.type === "removed"
  // → llamamos onNotificationRemoved → cerramos el modal
  useEffect(() => {
    if (!user || !isOnline) {
      unsubscribeRides?.();
      setUnsubscribeRides(null);
      return;
    }

    const unsub = listenToRideNotifications(
      user.uid,

      // ── onNewNotification: mostrar modal ──
      (notification) => {
        console.log("🔔 Nueva solicitud recibida:", notification.rideId);
        currentRideIdRef.current = notification.rideId;
        setCurrentNotification(notification);
        setNotificationVisible(true);
      },

      // ── onNotificationsChange (no usado) ──
      undefined,

      // ── onNotificationRemoved: cerrar modal ──
      // Esto se dispara cuando el doc deja de cumplir notificationStatus == "pending"
      // Es decir, cuando el pasajero cancela y expireAllDriverNotifications cambia el status
      (removedRideId) => {
        console.log(
          "🚫 Solicitud removida:",
          removedRideId,
          "| Actual:",
          currentRideIdRef.current,
        );

        // Cerrar modal si es la solicitud que estamos mostrando
        // Usamos el ref para evitar stale closure
        if (currentRideIdRef.current === removedRideId) {
          console.log("✅ Cerrando modal — pasajero canceló/expiró");
          setNotificationVisible(false);
          setCurrentNotification(null);
          currentRideIdRef.current = null;

          Alert.alert(
            "Solicitud cancelada",
            "El pasajero canceló o la solicitud expiró.",
            [{ text: "OK" }],
          );
        }
      },
    );

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
          // Cerrar modal si estaba abierto
          setNotificationVisible(false);
          setCurrentNotification(null);
          currentRideIdRef.current = null;
        }
      } else {
        Alert.alert("Error", result.error || "Error actualizando estado");
      }
    } catch {
      Alert.alert("Error", "No se pudo actualizar el estado");
    } finally {
      setUpdating(false);
    }
  };

  // ── Accept ride ──
  const handleAcceptRide = async (notification: RideNotification) => {
    if (!user || !driverData) return;
    const result = await acceptRideNotification(
      user.uid,
      notification.rideId,
      driverData,
    );
    if (result.success) {
      setNotificationVisible(false);
      setCurrentNotification(null);
      currentRideIdRef.current = null;
      router.push({
        pathname: "/(driver)/driver-trip-in-progress",
        params: {
          rideId: notification.rideId,
          pickup: JSON.stringify(notification.pickup),
          destination: JSON.stringify(notification.destination),
          distance: notification.distance.toString(),
          fare: notification.estimatedPrice.toString(),
        },
      });
    } else {
      Alert.alert("Error", result.error || "No se pudo aceptar el viaje");
    }
  };

  // ── Reject ride ──
  const handleRejectRide = async (notification: RideNotification) => {
    if (!user) return;
    const result = await rejectRideNotification(user.uid, notification.rideId);
    if (result.success) {
      setNotificationVisible(false);
      setCurrentNotification(null);
      currentRideIdRef.current = null;
    } else {
      Alert.alert("Error", result.error || "No se pudo rechazar el viaje");
    }
  };

  const scale = earningsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push("/(tabs)/profile")}
        >
          <View style={styles.avatarContainer}>
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={28} color="#fff" />
              </View>
            )}
            <View
              style={[
                styles.onlineBadge,
                { backgroundColor: isOnline ? "#10B981" : "#6B7280" },
              ]}
            />
          </View>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.appTitle}>Yakoo Driver</Text>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOnline ? "#10B981" : "#6B7280" },
              ]}
            />
            <Text style={styles.statusText}>
              {isOnline ? "ONLINE" : "OFFLINE"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => setShowNotifs(true)}
        >
          <Ionicons name="notifications" size={24} color="#fff" />
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: 3.8667,
            longitude: 11.5167,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
        />

        <Animated.View
          style={[styles.earningsCard, { transform: [{ scale }] }]}
        >
          <View style={styles.earningsLeft}>
            <Text style={styles.earningsLabel}>GANANCIAS TOTALES</Text>
            <Text style={styles.earningsAmount}>
              {totalEarnings.toLocaleString("es-GQ")} XAF
            </Text>
            <Text style={styles.earningsTrips}>
              {tripsCompleted} viajes completados
            </Text>
            <TouchableOpacity
              style={styles.detailsButton}
              onPress={() => router.push("/(tabs)/activity")}
            >
              <Text style={styles.detailsButtonText}>Ver detalles</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.earningsChart}>
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartLabel}>Ganancias</Text>
              <Text style={styles.chartLabel}>semanales</Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.statusToggleContainer}>
          <TouchableOpacity
            style={[
              styles.statusToggleButton,
              !isOnline && styles.statusToggleActive,
            ]}
            onPress={() => handleOnlineStatusChange(false)}
            disabled={updating}
          >
            <Text style={styles.statusToggleText}>Offline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.statusToggleButton,
              isOnline && styles.statusToggleActive,
            ]}
            onPress={() => handleOnlineStatusChange(true)}
            disabled={updating}
          >
            <Text style={styles.statusToggleText}>Online</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <TouchableOpacity
            style={styles.supermarketBtn}
            onPress={() => router.push("/(driver)/supermarket-orders")}
          >
            <Ionicons name="storefront-outline" size={20} color="#fff" />
            <Text style={styles.supermarketBtnTxt}>Pedidos Supermercados</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.restaurantBtn}
            onPress={() => router.push("/(driver)/restaurant-orders")}
          >
            <Ionicons name="restaurant-outline" size={20} color="#fff" />
            <Text style={styles.restaurantBtnTxt}>Pedidos Restaurantes</Text>
          </TouchableOpacity>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>VALORACIÓN</Text>
            <View style={styles.statContent}>
              <Text style={styles.statValue}>{rating}</Text>
              <Ionicons name="star" size={24} color="#FBBF24" />
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>ACEPTACIÓN</Text>
            <View style={styles.statContent}>
              <Text style={styles.statValue}>{acceptance}%</Text>
              <Ionicons name="checkmark-circle" size={24} color="#FF6B35" />
            </View>
          </View>
        </View>

        <View style={styles.statusDebug}>
          <Text style={styles.statusDebugText}>
            {isOnline ? "🟢 Online" : "🔴 Offline"}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Notification Panel Styles ────────────────────────────────
const st = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  panel: {
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
  panelHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#374151",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
    gap: 8,
  },
  panelTitle: { fontSize: 18, fontWeight: "800", color: "#fff", flex: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
  },
  unreadBadge: {
    backgroundColor: "#F2AB30",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadBadgeTxt: { fontSize: 11, fontWeight: "800", color: "#1F2937" },
  notifItem: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
    alignItems: "flex-start",
  },
  notifItemUnread: { backgroundColor: "#1A1F2E" },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  notifTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  notifTitle: { fontSize: 14, fontWeight: "700", color: "#fff", flex: 1 },
  notifTime: { fontSize: 11, color: "#6B7280", marginLeft: 8 },
  notifBody: { fontSize: 13, color: "#9CA3AF", lineHeight: 18 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F2AB30",
    flexShrink: 0,
    marginTop: 4,
  },
  emptyPanel: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyPanelTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  emptyPanelSub: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
});

// ── Main Styles ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1F2937" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  profileButton: { zIndex: 10 },
  avatarContainer: { position: "relative" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "#FF6B35",
  },
  avatarPlaceholder: {
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#111827",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  appTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 0.5,
  },
  notificationButton: {
    position: "relative",
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  notificationBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  mapContainer: { flex: 1, position: "relative" },
  map: { flex: 1 },
  earningsCard: {
    position: "absolute",
    top: 20,
    left: 16,
    right: 16,
    flexDirection: "row",
    backgroundColor: "#2D2420",
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  earningsLeft: { flex: 1, justifyContent: "space-between" },
  earningsLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.5,
  },
  earningsAmount: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    marginTop: 4,
  },
  earningsTrips: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FF6B35",
    marginTop: 4,
  },
  detailsButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 12,
  },
  detailsButtonText: { fontSize: 14, fontWeight: "700", color: "#1F2937" },
  earningsChart: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#5DADE2",
    justifyContent: "center",
    alignItems: "center",
  },
  chartPlaceholder: { alignItems: "center", gap: 4 },
  chartLabel: { fontSize: 12, fontWeight: "600", color: "#fff" },
  statusToggleContainer: {
    position: "absolute",
    top: 160,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#3F3F3F",
    borderRadius: 20,
    padding: 4,
  },
  statusToggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  statusToggleActive: { backgroundColor: "#FF6B35" },
  statusToggleText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  statsContainer: {
    position: "absolute",
    bottom: 140,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#2D2420",
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.5,
  },
  statContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  statValue: { fontSize: 24, fontWeight: "700", color: "#fff" },
  statusDebug: {
    position: "absolute",
    bottom: 20,
    left: 16,
    backgroundColor: "#2D2420",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusDebugText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  supermarketBtn: {
    position: "absolute",
    bottom: 80,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#16A34A",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  supermarketBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  restaurantBtn: {
    position: "absolute",
    bottom: 140,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F97316",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  restaurantBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
