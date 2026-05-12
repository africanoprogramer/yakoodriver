import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { updateDriverEarnings } from "@/utils/earningsService";
import {
  formatDistance,
  isNearPickupLocation,
  watchLocation,
} from "@/utils/geoLocationService";
import { verifyPin } from "@/utils/pickupPinService";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

interface Location {
  name: string;
  address: string;
  lat: number;
  lng: number;
}
interface Passenger {
  userId: string;
  userEmail: string;
  userPhone?: string;
}

const DEFAULT_LAT = 3.7504;
const DEFAULT_LNG = 8.7371;

export default function DriverTripInProgressScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [driverCoords, setDriverCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [rideId, setRideId] = useState<string>(
    typeof params.rideId === "string" ? params.rideId : "",
  );
  const [passenger, setPassenger] = useState<Passenger | null>(null);
  const [pickup, setPickup] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [tripStatus, setTripStatus] = useState<
    "accepted" | "arriving" | "in_progress" | "completed"
  >("arriving");
  const [expanded, setExpanded] = useState(false);
  const [distance, setDistance] = useState(5.2);
  const [fare, setFare] = useState(1300);
  const [rideCompleted, setRideCompleted] = useState(false);
  const [completingTrip, setCompletingTrip] = useState(false);
  const [driverDistance, setDriverDistance] = useState<number | null>(null);
  const [isNearPickup, setIsNearPickup] = useState(false);
  const [checkingDistance, setCheckingDistance] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinVerifying, setPinVerifying] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const mapRef = useRef<MapView>(null);
  const [driverProfile, setDriverProfile] = useState<{
    fullName?: string;
    phone?: string;
  } | null>(null);

  // Cargar perfil del conductor desde Firestore
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "drivers", user.uid))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setDriverProfile({ fullName: data.fullName, phone: data.phone });
        }
      })
      .catch(() => {});
  }, [user?.uid]);

  useEffect(() => {
    if (!rideId && typeof params.rideId === "string") setRideId(params.rideId);
    if (params.pickup && typeof params.pickup === "string")
      try {
        setPickup(JSON.parse(params.pickup));
      } catch {}
    if (params.destination && typeof params.destination === "string")
      try {
        setDestination(JSON.parse(params.destination));
      } catch {}
    if (params.distance && typeof params.distance === "string")
      setDistance(parseFloat(params.distance));
    if (params.fare && typeof params.fare === "string")
      setFare(parseFloat(params.fare));
  }, [
    params.rideId,
    params.pickup,
    params.destination,
    params.distance,
    params.fare,
  ]);

  useEffect(() => {
    if (!rideId) return;
    let isMounted = true;
    const unsub = onSnapshot(doc(db, "rides", rideId), (snap) => {
      if (!isMounted) return;
      const data = snap.data();
      if (!data) return;
      if (data.status === "cancelled" && data.cancelledBy === "passenger") {
        Alert.alert(
          "Viaje cancelado",
          `Pasajero canceló.\nMotivo: ${data.cancelReason || "Sin motivo"}`,
          [{ text: "OK", onPress: () => router.replace("/(tabs)") }],
        );
        return;
      }
      setTripStatus(
        data.status === "accepted" ? "arriving" : data.status || "arriving",
      );
      if (data.distance) setDistance(data.distance);
      if (data.estimatedPrice) setFare(data.estimatedPrice);
      if (data.userId && !passenger)
        setPassenger({
          userId: data.userId,
          userEmail: data.userEmail || "",
          userPhone: data.userPhone || "",
        });
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, [rideId]);

  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, []);

  useEffect(() => {
    if (!rideId || tripStatus === "completed") return;
    console.log("📡 Iniciando GPS real para publicar ubicación...");
    const stop = watchLocation(
      async (c) => {
        setDriverCoords(c);
        console.log(
          "📍 Publicando ubicación:",
          c.latitude.toFixed(4),
          c.longitude.toFixed(4),
        );
        try {
          await updateDoc(doc(db, "rides", rideId), {
            driverLocation: {
              lat: c.latitude,
              lng: c.longitude,
              updatedAt: new Date(),
            },
          });
        } catch (e) {
          console.error("❌ Error publicando ubicación:", e);
        }
      },
      (err) => {
        console.error("❌ GPS error:", err);
      },
    );
    return () => stop();
  }, [rideId, tripStatus]);

  const handleCallPassenger = () => {
    if (passenger?.userPhone) Linking.openURL(`tel:${passenger.userPhone}`);
  };
  const handleMessagePassenger = () => {
    if (passenger?.userPhone) Linking.openURL(`sms:${passenger.userPhone}`);
  };

  const handleCheckDistance = async () => {
    if (!pickup) return;
    setCheckingDistance(true);
    const result = await isNearPickupLocation(
      { latitude: pickup.lat, longitude: pickup.lng },
      100,
    );
    setCheckingDistance(false);
    setDriverDistance(result.distance);
    if (!result.isNear) {
      Alert.alert(
        "Muy lejos",
        `Estás a ${formatDistance(result.distance)}. Debes estar a menos de 100m.`,
      );
      setIsNearPickup(false);
      return;
    }
    setIsNearPickup(true);
    setShowPinInput(true);
    Alert.alert("✅ Cerca", "Ingresa el PIN del pasajero");
  };

  const handleVerifyPin = async () => {
    if (!pinInput || pinInput.length !== 4) {
      Alert.alert("Error", "4 dígitos");
      return;
    }
    if (!rideId || !user) return;
    setPinVerifying(true);
    const ok = await verifyPin(rideId, pinInput);
    setPinVerifying(false);
    if (!ok) {
      Alert.alert("Error", "PIN incorrecto o expirado");
      return;
    }
    await updateDoc(doc(db, "rides", rideId), {
      status: "in_progress",
      arrivedAt: new Date(),
      pickupVerifiedWith: "geolocation_pin",
      pickupVerifiedAt: new Date(),
    });
    setTripStatus("in_progress");
    setPinInput("");
    setShowPinInput(false);
    Alert.alert("✅", "Recogida confirmada");
  };

  // ══════════════════════════════════════════════════════════
  // COMPLETAR VIAJE + ESCRIBIR COMISIÓN EN admin_commissions
  // ══════════════════════════════════════════════════════════
  const handleCompleteTrip = () => {
    if (!rideId || !user) return;
    Alert.alert("¿Completar viaje?", "¿Has llegado al destino?", [
      { text: "No" },
      {
        text: "Sí, completado",
        onPress: async () => {
          setCompletingTrip(true);
          const commissionRate = 10;
          const commission = Math.round(fare * (commissionRate / 100));
          const driverEarnings = fare - commission;

          // 1. Actualizar ride
          await updateDoc(doc(db, "rides", rideId), {
            status: "completed",
            completedAt: new Date(),
            fare,
            commission,
            commissionRate,
            driverEarnings,
            paymentMethod: "cash",
          });

          // 2. Ganancias conductor
          const result = await updateDriverEarnings(
            user.uid,
            driverEarnings,
            rideId,
            commission,
          );

          // 3. ── COMISIÓN PARA ADMIN ──
          try {
            await setDoc(doc(db, "admin_commissions", `uber_${rideId}`), {
              restaurantId: "yakoo_uber",
              restaurantName: "Yakoo Uber (Viajes)",
              orderId: rideId,
              source: "uber",
              orderTotal: fare,
              commissionRate,
              commissionAmount: commission,
              restaurantNet: driverEarnings,
              driverId: user.uid,
              driverName:
                driverProfile?.fullName || user.displayName || "Conductor",
              passengerId: passenger?.userId || null,
              passengerEmail: passenger?.userEmail || null,
              pickup: pickup
                ? { name: pickup.name, address: pickup.address }
                : null,
              destination: destination
                ? { name: destination.name, address: destination.address }
                : null,
              distance,
              paymentMethod: "cash",
              createdAt: serverTimestamp(),
            });
            console.log("✅ Comisión registrada en admin_commissions");
          } catch (e) {
            console.error("⚠️ Error guardando comisión:", e);
          }

          setCompletingTrip(false);
          if (result.success) {
            setTripStatus("completed");
            setRideCompleted(true);
            Alert.alert(
              "¡Viaje Completado! 🎉",
              `Tarifa: ${fare.toLocaleString("es-GQ")} XAF\nComisión (${commissionRate}%): -${commission.toLocaleString("es-GQ")} XAF\n──────────────\nTu ganancia: ${driverEarnings.toLocaleString("es-GQ")} XAF`,
              [
                {
                  text: "OK",
                  onPress: () =>
                    setTimeout(() => router.replace("/(tabs)"), 500),
                },
              ],
            );
          } else Alert.alert("Error", "No se pudo registrar ganancias");
        },
      },
    ]);
  };

  const handleCancelTrip = () => {
    Alert.alert("¿Cancelar?", "¿Estás seguro?", [
      { text: "No" },
      {
        text: "Sí",
        style: "destructive",
        onPress: async () => {
          if (!rideId) return;
          await updateDoc(doc(db, "rides", rideId), {
            status: "cancelled",
            cancelledAt: new Date(),
            cancelledBy: "driver",
          });
          Alert.alert("Cancelado", "Pasajero notificado", [
            { text: "OK", onPress: () => router.replace("/(tabs)") },
          ]);
        },
      },
    ]);
  };

  // Centrar mapa en todos los puntos
  useEffect(() => {
    if (!pickup || !destination) return;
    const timer = setTimeout(() => {
      const coords = [
        { latitude: pickup.lat, longitude: pickup.lng },
        { latitude: destination.lat, longitude: destination.lng },
      ];
      if (driverCoords) {
        coords.push({
          latitude: driverCoords.latitude,
          longitude: driverCoords.longitude,
        });
      }
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 60, bottom: 320, left: 60 },
        animated: true,
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [pickup, destination, driverCoords]);

  if (!rideId || !pickup || !destination)
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingContainer}>
          <Text style={s.loadingText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );

  const pLat = pickup.lat,
    pLng = pickup.lng,
    dLat = destination.lat,
    dLng = destination.lng;
  const drLat = driverCoords?.latitude ?? pLat;
  const drLng = driverCoords?.longitude ?? pLng;
  const hasDriverCoords = driverCoords !== null;

  const mapRegion = {
    latitude: (pLat + dLat) / 2,
    longitude: (pLng + dLng) / 2,
    latitudeDelta: Math.max(Math.abs(pLat - dLat) * 2.5, 0.05),
    longitudeDelta: Math.max(Math.abs(pLng - dLng) * 2.5, 0.05),
  };

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <MapView
        ref={mapRef}
        style={s.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={mapRegion}
      >
        {/* Línea morada discontinua: conductor → pickup */}
        {hasDriverCoords && (
          <Polyline
            coordinates={[
              { latitude: drLat, longitude: drLng },
              { latitude: pLat, longitude: pLng },
            ]}
            strokeColor="#9333EA"
            strokeWidth={4}
            geodesic
            lineDashPattern={[10, 8]}
          />
        )}
        {/* Línea naranja sólida: pickup → destino */}
        <Polyline
          coordinates={[
            { latitude: pLat, longitude: pLng },
            { latitude: dLat, longitude: dLng },
          ]}
          strokeColor="#FF6B35"
          strokeWidth={5}
          geodesic
        />
        <Marker
          coordinate={{ latitude: pLat, longitude: pLng }}
          pinColor="#FF6B35"
          title="Recogida"
        />
        {hasDriverCoords && (
          <Animated.View
            style={[s.driverMarker, { transform: [{ scale: pulseAnim }] }]}
          >
            <Marker
              coordinate={{ latitude: drLat, longitude: drLng }}
              pinColor="#9333EA"
              title="Tu posición"
            />
          </Animated.View>
        )}
        <Marker
          coordinate={{ latitude: dLat, longitude: dLng }}
          pinColor="#10B981"
          title="Destino"
        />
      </MapView>

      <TouchableOpacity
        style={s.backBtn}
        onPress={() => {
          if (!rideCompleted) handleCancelTrip();
          else router.replace("/(tabs)");
        }}
      >
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>

      <View
        style={[
          s.sheet,
          expanded && s.sheetExp,
          tripStatus === "arriving" && showPinInput && s.sheetPin,
        ]}
      >
        <TouchableOpacity
          style={s.handleWrap}
          onPress={() => setExpanded(!expanded)}
        >
          <View style={s.handle} />
        </TouchableOpacity>

        {!expanded && (
          <View style={s.collapsed}>
            <View style={s.pCard}>
              <View style={s.pAvatar}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.pName}>Pasajero</Text>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Ionicons name="star" size={14} color="#FBBF24" />
                  <Text style={s.pRating}>4.8</Text>
                </View>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={s.distVal}>{distance.toFixed(1)}</Text>
                <Text style={s.distLbl}>km</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={s.actBtn}
                  onPress={handleCallPassenger}
                >
                  <Ionicons name="call" size={20} color="#FF6B35" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.actBtn}
                  onPress={handleMessagePassenger}
                >
                  <Ionicons name="chatbubble" size={20} color="#FF6B35" />
                </TouchableOpacity>
              </View>
            </View>

            {tripStatus === "arriving" && driverDistance !== null && (
              <View
                style={[
                  s.distAlert,
                  { backgroundColor: isNearPickup ? "#D1FAE5" : "#FEF3C7" },
                ]}
              >
                <Text
                  style={[
                    s.distAlertTxt,
                    { color: isNearPickup ? "#065F46" : "#92400E" },
                  ]}
                >
                  {isNearPickup ? "🟢 Muy cerca" : "🟡 Casi llego"}
                </Text>
                <Text
                  style={[
                    s.distAlertVal,
                    { color: isNearPickup ? "#10B981" : "#FF6B35" },
                  ]}
                >
                  {formatDistance(driverDistance)}
                </Text>
              </View>
            )}

            <View style={s.badgeWrap}>
              <View
                style={[
                  s.badge,
                  {
                    backgroundColor:
                      tripStatus === "arriving"
                        ? "#FEF3C7"
                        : tripStatus === "in_progress"
                          ? "#DBEAFE"
                          : "#D1FAE5",
                  },
                ]}
              >
                <Text
                  style={[
                    s.badgeTxt,
                    {
                      color:
                        tripStatus === "arriving"
                          ? "#92400E"
                          : tripStatus === "in_progress"
                            ? "#1E40AF"
                            : "#065F46",
                    },
                  ]}
                >
                  {tripStatus === "arriving" || tripStatus === "accepted"
                    ? "🚗 En camino al pasajero"
                    : tripStatus === "in_progress"
                      ? "📍 Viajando"
                      : "✅ Completado"}
                </Text>
              </View>
            </View>

            {tripStatus === "arriving" && showPinInput && (
              <View style={s.pinBox}>
                <Text style={s.pinLabel}>Código del pasajero:</Text>
                <TextInput
                  style={s.pinInput}
                  placeholder="0000"
                  value={pinInput}
                  onChangeText={setPinInput}
                  maxLength={4}
                  keyboardType="numeric"
                  editable={!pinVerifying}
                />
                <TouchableOpacity
                  style={[
                    s.pinBtn,
                    (pinVerifying || pinInput.length !== 4) && s.disabled,
                  ]}
                  onPress={handleVerifyPin}
                  disabled={pinVerifying || pinInput.length !== 4}
                >
                  <Text style={s.pinBtnTxt}>
                    {pinVerifying ? "Verificando..." : "Verificar"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {tripStatus === "arriving" && (
              <TouchableOpacity
                style={[s.primaryBtn, checkingDistance && s.disabled]}
                onPress={handleCheckDistance}
                disabled={checkingDistance}
              >
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={s.primaryBtnTxt}>
                  {checkingDistance
                    ? "Verificando..."
                    : isNearPickup
                      ? "Verificar PIN"
                      : "Acércate al Pasajero"}
                </Text>
              </TouchableOpacity>
            )}
            {tripStatus === "in_progress" && (
              <TouchableOpacity
                style={[s.primaryBtn, completingTrip && s.disabled]}
                onPress={handleCompleteTrip}
                disabled={completingTrip}
              >
                <Ionicons name="flag" size={20} color="#fff" />
                <Text style={s.primaryBtnTxt}>
                  {completingTrip ? "Procesando..." : "Viaje Completado"}
                </Text>
              </TouchableOpacity>
            )}
            {!rideCompleted && (
              <TouchableOpacity style={s.cancelBtn} onPress={handleCancelTrip}>
                <Ionicons name="close" size={16} color="#EF4444" />
                <Text style={s.cancelBtnTxt}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {expanded && (
          <ScrollView style={s.expContent} showsVerticalScrollIndicator={false}>
            <View style={s.section}>
              <Text style={s.secTitle}>Ruta</Text>
              <View style={s.routeBox}>
                <View style={s.routeRow}>
                  <View style={s.routeIcon}>
                    <Ionicons name="location" size={20} color="#FF6B35" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.routeLbl}>Recogida</Text>
                    <Text style={s.routeName}>{pickup.name}</Text>
                  </View>
                </View>
                <View style={s.routeLine} />
                <View style={s.routeRow}>
                  <View style={s.routeIcon}>
                    <Ionicons name="flag" size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.routeLbl}>Destino</Text>
                    <Text style={s.routeName}>{destination.name}</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={s.section}>
              <Text style={s.secTitle}>Detalles</Text>
              <View style={s.detGrid}>
                <View style={s.detItem}>
                  <View style={s.detIcon}>
                    <Ionicons name="navigate" size={24} color="#FF6B35" />
                  </View>
                  <Text style={s.detLbl}>Distancia</Text>
                  <Text style={s.detVal}>{distance.toFixed(1)} km</Text>
                </View>
                <View style={[s.detItem, s.fareHL]}>
                  <View style={[s.detIcon, s.fareIconHL]}>
                    <Ionicons name="cash" size={24} color="#fff" />
                  </View>
                  <Text style={s.detLbl}>Tarifa</Text>
                  <Text style={[s.detVal, s.fareValHL]}>
                    {fare.toLocaleString("es-GQ")} XAF
                  </Text>
                </View>
              </View>
            </View>
            {rideCompleted && (
              <View style={s.doneBox}>
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                <Text style={s.doneTitle}>¡Completado!</Text>
                <Text style={s.doneEarn}>
                  💰 +{fare.toLocaleString("es-GQ")} XAF
                </Text>
              </View>
            )}
            {!rideCompleted && (
              <TouchableOpacity
                style={s.cancelBtnBig}
                onPress={handleCancelTrip}
              >
                <Ionicons name="close" size={20} color="#EF4444" />
                <Text style={s.cancelBtnBigTxt}>Cancelar</Text>
              </TouchableOpacity>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1F2937" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 16, color: "#6B7280" },
  map: { flex: 1 },
  driverMarker: { justifyContent: "center", alignItems: "center" },
  backBtn: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "40%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  sheetExp: { maxHeight: "95%" },
  sheetPin: { maxHeight: "75%", paddingBottom: 20 },
  handleWrap: { alignItems: "center", paddingVertical: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB" },
  collapsed: { paddingHorizontal: 20, paddingBottom: 20 },
  pCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  pAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
  },
  pName: { fontSize: 16, fontWeight: "700", color: "#1F2937", marginBottom: 2 },
  pRating: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  distVal: { fontSize: 20, fontWeight: "700", color: "#FF6B35" },
  distLbl: { fontSize: 11, color: "#6B7280", fontWeight: "600" },
  actBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  distAlert: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#FF6B35",
  },
  distAlertTxt: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  distAlertVal: { fontSize: 24, fontWeight: "700", textAlign: "center" },
  badgeWrap: { marginBottom: 12 },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  badgeTxt: { fontSize: 13, fontWeight: "600" },
  pinBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pinLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 10,
  },
  pinInput: {
    fontSize: 24,
    fontWeight: "700",
    borderWidth: 2,
    borderColor: "#FF6B35",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    textAlign: "center",
    letterSpacing: 4,
    marginBottom: 10,
    color: "#1F2937",
  },
  pinBtn: {
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  pinBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  disabled: { opacity: 0.5 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    backgroundColor: "#FF6B35",
    borderRadius: 10,
    marginBottom: 10,
  },
  primaryBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
  },
  cancelBtnTxt: { fontSize: 13, fontWeight: "600", color: "#EF4444" },
  expContent: { paddingHorizontal: 20, paddingTop: 8 },
  section: { marginBottom: 24 },
  secTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
  },
  routeBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  routeRow: { flexDirection: "row", gap: 10 },
  routeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFE5CC",
    justifyContent: "center",
    alignItems: "center",
  },
  routeLbl: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "600",
    marginBottom: 2,
  },
  routeName: { fontSize: 12, fontWeight: "700", color: "#1F2937" },
  routeLine: {
    height: 20,
    width: 2,
    backgroundColor: "#E5E7EB",
    marginLeft: 15,
  },
  detGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  detItem: {
    width: "48%",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  fareHL: { backgroundColor: "#10B981" },
  detIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  fareIconHL: { backgroundColor: "#059669" },
  detLbl: { fontSize: 10, color: "#9CA3AF", fontWeight: "600" },
  detVal: { fontSize: 14, fontWeight: "700", color: "#1F2937" },
  fareValHL: { color: "#fff" },
  cancelBtnBig: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
  },
  cancelBtnBigTxt: { fontSize: 14, fontWeight: "700", color: "#EF4444" },
  doneBox: { alignItems: "center", paddingVertical: 24, gap: 10 },
  doneTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937" },
  doneEarn: { fontSize: 16, fontWeight: "700", color: "#10B981" },
});
