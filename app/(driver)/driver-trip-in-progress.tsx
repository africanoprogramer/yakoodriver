import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { updateDriverEarnings } from "@/utils/earningsService";
import { formatDistance, watchLocation } from "@/utils/geoLocationService";
import { verifyPin } from "@/utils/pickupPinService";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
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

const DEFAULT_LAT = 3.8667;
const DEFAULT_LNG = 11.5167;

export default function DriverTripInProgressScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const [driverCoords, setDriverCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  // Estados principales
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

  // Estados de geolocalización
  const [driverDistance, setDriverDistance] = useState<number | null>(null);
  const [isNearPickup, setIsNearPickup] = useState(false);
  const [checkingDistance, setCheckingDistance] = useState(false);

  // Estados de PIN
  const [pinInput, setPinInput] = useState("");
  const [pinVerifying, setPinVerifying] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);

  // Animaciones
  const [pulseAnim] = useState(new Animated.Value(1));

  // Parsear parámetros
  useEffect(() => {
    if (!rideId && typeof params.rideId === "string") {
      setRideId(params.rideId);
    }

    if (params.pickup && typeof params.pickup === "string") {
      try {
        setPickup(JSON.parse(params.pickup));
      } catch (e) {
        console.error("Error parsing pickup:", e);
      }
    }

    if (params.destination && typeof params.destination === "string") {
      try {
        setDestination(JSON.parse(params.destination));
      } catch (e) {
        console.error("Error parsing destination:", e);
      }
    }

    if (params.distance && typeof params.distance === "string") {
      setDistance(parseFloat(params.distance));
    }

    if (params.fare && typeof params.fare === "string") {
      setFare(parseFloat(params.fare));
    }
  }, [
    params.rideId,
    params.pickup,
    params.destination,
    params.distance,
    params.fare,
  ]);

  // Escuchar cambios en el ride
  useEffect(() => {
    if (!rideId) return;

    const rideRef = doc(db, "rides", rideId);
    let isMounted = true;

    const unsubscribe = onSnapshot(rideRef, (snapshot) => {
      if (!isMounted) return;
      const data = snapshot.data();
      if (data) {
        console.log("📊 Ride status:", data.status);

        // Detectar cancelación del pasajero PRIMERO
        if (data.status === "cancelled" && data.cancelledBy === "passenger") {
          Alert.alert(
            "Viaje cancelado",
            `El pasajero canceló el viaje.\nMotivo: ${data.cancelReason || "Sin motivo"}`,
            [{ text: "OK", onPress: () => router.replace("/(tabs)") }],
          );
          return; // ← No seguir procesando
        }

        const mapped = data.status === "accepted" ? "arriving" : data.status;
        setTripStatus(mapped || "arriving");

        if (data.distance) setDistance(data.distance);
        if (data.estimatedPrice) setFare(data.estimatedPrice);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [rideId]);

  // Animación de pulso
  useEffect(() => {
    const animation = Animated.loop(
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

    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  // Publicar ubicación del conductor en Firestore en tiempo real
  useEffect(() => {
    if (!rideId || tripStatus === "completed") return;

    console.log("📡 Iniciando publicación de ubicación...");

    const stopWatching = watchLocation(
      async (coords) => {
        setDriverCoords(coords);
        try {
          await updateDoc(doc(db, "rides", rideId), {
            driverLocation: {
              lat: coords.latitude,
              lng: coords.longitude,
              updatedAt: new Date(),
            },
          });
        } catch (error) {
          console.error("Error actualizando ubicación:", error);
        }
      },
      (error) => console.error("Error GPS:", error),
    );

    return () => stopWatching();
  }, [rideId, tripStatus]);

  const handleCallPassenger = () => {
    if (passenger?.userPhone) {
      Linking.openURL(`tel:${passenger.userPhone}`);
    }
  };

  const handleMessagePassenger = () => {
    if (passenger?.userPhone) {
      Linking.openURL(`sms:${passenger.userPhone}`);
    }
  };

  /**
   * PASO 1: Verificar Geolocalización
   */
  const handleCheckDistance = async () => {
    try {
      if (!pickup) return;

      setCheckingDistance(true);
      console.log("📍 Verificando distancia...");

      // 🔧 PARA TESTING: Simular que el conductor está cerca
      const mockDistance = 50; // 50 metros

      setCheckingDistance(false);
      setDriverDistance(mockDistance);

      if (mockDistance > 100) {
        Alert.alert(
          "Muy lejos",
          `Estás a ${formatDistance(mockDistance)} de distancia.\n\nDebe ser menos de 100 metros.`,
          [{ text: "OK" }],
        );
        setIsNearPickup(false);
        return;
      }

      // Está cerca - mostrar PIN input
      setIsNearPickup(true);
      setShowPinInput(true);
      Alert.alert(
        "✅ Estás lo suficientemente cerca",
        "Ahora ingresa el código PIN del pasajero",
        [{ text: "OK" }],
      );
    } catch (error) {
      console.error("Error:", error);
      setCheckingDistance(false);
      Alert.alert("Error", "No se pudo verificar la distancia");
    }
  };

  /**
   * PASO 2: Verificar PIN
   */
  const handleVerifyPin = async () => {
    try {
      if (!pinInput || pinInput.length !== 4) {
        Alert.alert("Error", "El código debe tener 4 dígitos");
        return;
      }

      if (!rideId || !user) return;

      setPinVerifying(true);
      console.log("🔐 Verificando PIN...");

      const isValid = await verifyPin(rideId, pinInput);

      setPinVerifying(false);

      if (!isValid) {
        Alert.alert("Error", "Código incorrecto o expirado");
        return;
      }

      // PIN VERIFICADO - Confirmar recogida
      console.log("✅ PIN verificado - Confirmando recogida");

      await updateDoc(doc(db, "rides", rideId), {
        status: "in_progress",
        arrivedAt: new Date(),
        pickupVerifiedWith: "geolocation_pin",
        pickupVerifiedAt: new Date(),
      });

      setTripStatus("in_progress");
      setPinInput("");
      setShowPinInput(false);

      Alert.alert("✅", "Recogida confirmada con éxito");
    } catch (error) {
      console.error("Error:", error);
      setPinVerifying(false);
      Alert.alert("Error", "Hubo un error verificando el PIN");
    }
  };

  const handleCompleteTrip = async () => {
    try {
      if (!rideId || !user) return;

      Alert.alert("¿Completar viaje?", "¿Has llegado al destino?", [
        { text: "No" },
        {
          text: "Sí, completado",
          onPress: async () => {
            setCompletingTrip(true);

            const commission = Math.round(fare * 0.1); // 10% Yakoo
            const driverEarnings = fare - commission; // 90% conductor

            // 1. Actualizar el ride con desglose financiero
            await updateDoc(doc(db, "rides", rideId), {
              status: "completed",
              completedAt: new Date(),
              fare: fare,
              commission: commission,
              driverEarnings: driverEarnings,
              paymentMethod: "cash",
            });

            // 2. Actualizar ganancias y descontar comisión del balance del conductor
            const earningsResult = await updateDriverEarnings(
              user.uid,
              driverEarnings, // ← solo el 90%, no el 100%
              rideId,
              commission, // ← pasa la comisión para descontarla del balance
            );

            setCompletingTrip(false);

            if (earningsResult.success) {
              setTripStatus("completed");
              setRideCompleted(true);

              Alert.alert(
                "¡Viaje Completado! 🎉",
                `Tarifa cobrada: ${fare.toLocaleString("es-GQ")} XAF\n` +
                  `Comisión Yakoo (10%): -${commission.toLocaleString("es-GQ")} XAF\n` +
                  `──────────────────\n` +
                  `Tu ganancia: ${driverEarnings.toLocaleString("es-GQ")} XAF`,
                [
                  {
                    text: "OK",
                    onPress: () => {
                      setTimeout(() => router.back(), 500);
                    },
                  },
                ],
              );
            }
          },
        },
      ]);
    } catch (error) {
      console.error("Error:", error);
      setCompletingTrip(false);
    }
  };

  const handleCancelTrip = () => {
    Alert.alert("¿Cancelar viaje?", "¿Estás seguro?", [
      { text: "No" },
      {
        text: "Sí, cancelar",
        onPress: async () => {
          try {
            if (!rideId) return;

            await updateDoc(doc(db, "rides", rideId), {
              status: "cancelled",
              cancelledAt: new Date(),
              cancelledBy: "driver",
            });

            Alert.alert("Cancelado", "Pasajero notificado", [
              { text: "OK", onPress: () => router.back() },
            ]);
          } catch (error) {
            console.error("Error:", error);
          }
        },
        style: "destructive",
      },
    ]);
  };

  if (!rideId || !pickup || !destination) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando viaje...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pickupLat = pickup.lat;
  const pickupLng = pickup.lng;
  const destLat = destination.lat;
  const destLng = destination.lng;
  const driverLat = driverCoords?.latitude ?? (pickupLat + destLat) / 2 - 0.005;
  const driverLng =
    driverCoords?.longitude ?? (pickupLng + destLng) / 2 - 0.005;

  const initialRegion = {
    latitude: (pickupLat + destLat) / 2,
    longitude: (pickupLng + destLng) / 2,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        <Polyline
          coordinates={[
            { latitude: pickupLat, longitude: pickupLng },
            { latitude: driverLat, longitude: driverLng },
            { latitude: destLat, longitude: destLng },
          ]}
          strokeColor="#FF6B35"
          strokeWidth={3}
          geodesic={true}
        />

        <Marker
          coordinate={{ latitude: pickupLat, longitude: pickupLng }}
          pinColor="#FF6B35"
        />

        <Animated.View
          style={[
            styles.driverMarkerContainer,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Marker
            coordinate={{ latitude: driverLat, longitude: driverLng }}
            pinColor="#9333EA"
          />
        </Animated.View>

        <Marker
          coordinate={{ latitude: destLat, longitude: destLng }}
          pinColor="#10B981"
        />
      </MapView>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          if (!rideCompleted) {
            handleCancelTrip();
          } else {
            router.back();
          }
        }}
      >
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>

      <View
        style={[
          styles.bottomSheet,
          expanded && styles.bottomSheetExpanded,
          tripStatus === "arriving" &&
            showPinInput &&
            styles.bottomSheetWithPin,
        ]}
      >
        <TouchableOpacity
          style={styles.handleContainer}
          onPress={() => setExpanded(!expanded)}
        >
          <View style={styles.handle} />
        </TouchableOpacity>

        {!expanded && (
          <View style={styles.collapsedContent}>
            <View style={styles.passengerCard}>
              <View style={styles.passengerAvatarContainer}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>

              <View style={styles.passengerInfoLeft}>
                <Text style={styles.passengerName}>Pasajero</Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#FBBF24" />
                  <Text style={styles.ratingText}>4.8</Text>
                </View>
              </View>

              <View style={styles.distanceContainer}>
                <Text style={styles.distanceValue}>{distance.toFixed(1)}</Text>
                <Text style={styles.distanceLabel}>km</Text>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleCallPassenger}
                >
                  <Ionicons name="call" size={20} color="#FF6B35" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleMessagePassenger}
                >
                  <Ionicons name="chatbubble" size={20} color="#FF6B35" />
                </TouchableOpacity>
              </View>
            </View>

            {/* 📍 DISTANCIA EN TIEMPO REAL */}
            {tripStatus === "arriving" && driverDistance !== null && (
              <View
                style={[
                  styles.distanceAlert,
                  {
                    backgroundColor: isNearPickup ? "#D1FAE5" : "#FEF3C7",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.distanceAlertText,
                    {
                      color: isNearPickup ? "#065F46" : "#92400E",
                    },
                  ]}
                >
                  {isNearPickup ? "🟢 Estoy muy cerca" : "🟡 Casi llego"}
                </Text>
                <Text
                  style={[
                    styles.distanceAlertValue,
                    {
                      color: isNearPickup ? "#10B981" : "#FF6B35",
                    },
                  ]}
                >
                  {formatDistance(driverDistance)}
                </Text>
              </View>
            )}

            <View style={styles.statusBadgeContainer}>
              <View
                style={[
                  styles.statusBadge,
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
                    styles.statusBadgeText,
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
                      ? "📍 Viajando con pasajero"
                      : "✅ Viaje completado"}
                </Text>
              </View>
            </View>

            {/* 🔐 PIN INPUT EN COLLAPSED */}
            {tripStatus === "arriving" && showPinInput && (
              <View style={styles.pinInputContainer}>
                <Text style={styles.pinInputLabel}>
                  Ingresa el código del pasajero:
                </Text>
                <TextInput
                  style={styles.pinInput}
                  placeholder="0000"
                  value={pinInput}
                  onChangeText={setPinInput}
                  maxLength={4}
                  keyboardType="numeric"
                  editable={!pinVerifying}
                />
                <TouchableOpacity
                  style={[
                    styles.pinVerifyButton,
                    (pinVerifying || pinInput.length !== 4) &&
                      styles.pinVerifyButtonDisabled,
                  ]}
                  onPress={handleVerifyPin}
                  disabled={pinVerifying || pinInput.length !== 4}
                >
                  <Text style={styles.pinVerifyText}>
                    {pinVerifying ? "Verificando..." : "Verificar"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* BOTÓN PRINCIPAL */}
            {tripStatus === "arriving" && (
              <TouchableOpacity
                style={[
                  styles.actionButtonPrimary,
                  checkingDistance && styles.actionButtonDisabled,
                ]}
                onPress={handleCheckDistance}
                disabled={checkingDistance}
              >
                {checkingDistance ? (
                  <Ionicons name="hourglass" size={20} color="#fff" />
                ) : (
                  <Ionicons name="navigate" size={20} color="#fff" />
                )}
                <Text style={styles.actionButtonText}>
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
                style={[
                  styles.actionButtonPrimary,
                  completingTrip && styles.actionButtonDisabled,
                ]}
                onPress={handleCompleteTrip}
                disabled={completingTrip}
              >
                <Ionicons name="flag" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>
                  {completingTrip ? "Procesando..." : "Viaje Completado"}
                </Text>
              </TouchableOpacity>
            )}

            {!rideCompleted && (
              <TouchableOpacity
                style={styles.cancelButtonCollapsed}
                onPress={handleCancelTrip}
              >
                <Ionicons name="close" size={16} color="#EF4444" />
                <Text style={styles.cancelButtonCollapsedText}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {expanded && (
          <ScrollView
            style={styles.expandedContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Información del pasajero */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pasajero</Text>
              <View style={styles.passengerDetailCard}>
                <View style={styles.detailRow}>
                  <View style={styles.largeAvatar}>
                    <Ionicons name="person" size={32} color="#fff" />
                  </View>
                  <View style={styles.passengerDetails}>
                    <Text style={styles.detailName}>Pasajero</Text>
                    <Text style={styles.passengerEmail}>
                      {passenger?.userEmail}
                    </Text>
                    {passenger?.userPhone && (
                      <Text style={styles.passengerPhone}>
                        {passenger.userPhone}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.detailActions}>
                  <TouchableOpacity
                    style={styles.detailActionButton}
                    onPress={handleCallPassenger}
                  >
                    <Ionicons name="call" size={22} color="#FF6B35" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.detailActionButton}
                    onPress={handleMessagePassenger}
                  >
                    <Ionicons name="chatbubble" size={22} color="#FF6B35" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Ruta */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ruta</Text>
              <View style={styles.routeInfo}>
                <View style={styles.routeItem}>
                  <View style={styles.routeItemIcon}>
                    <Ionicons name="location" size={20} color="#FF6B35" />
                  </View>
                  <View style={styles.routeItemText}>
                    <Text style={styles.routeItemLabel}>Recogida</Text>
                    <Text style={styles.routeItemName}>{pickup.name}</Text>
                  </View>
                </View>

                <View style={styles.routeLine} />

                <View style={styles.routeItem}>
                  <View style={styles.routeItemIcon}>
                    <Ionicons name="flag" size={20} color="#10B981" />
                  </View>
                  <View style={styles.routeItemText}>
                    <Text style={styles.routeItemLabel}>Destino</Text>
                    <Text style={styles.routeItemName}>{destination.name}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Detalles */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detalles</Text>
              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <View style={styles.detailItemIcon}>
                    <Ionicons name="navigate" size={24} color="#FF6B35" />
                  </View>
                  <Text style={styles.detailItemLabel}>Distancia</Text>
                  <Text style={styles.detailItemValue}>
                    {distance.toFixed(1)} km
                  </Text>
                </View>

                <View style={[styles.detailItem, styles.fareHighlight]}>
                  <View
                    style={[styles.detailItemIcon, styles.fareIconHighlight]}
                  >
                    <Ionicons name="cash" size={24} color="#fff" />
                  </View>
                  <Text style={styles.detailItemLabel}>Tarifa</Text>
                  <Text
                    style={[styles.detailItemValue, styles.fareValueHighlight]}
                  >
                    {fare.toLocaleString("es-GQ")} XAF
                  </Text>
                </View>
              </View>
            </View>

            {/* Acciones */}
            <View style={styles.section}>
              {tripStatus === "arriving" && (
                <TouchableOpacity
                  style={styles.actionButtonPrimary}
                  onPress={handleCheckDistance}
                  disabled={checkingDistance}
                >
                  <Ionicons name="navigate" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>
                    {checkingDistance ? "Verificando..." : "Acércate"}
                  </Text>
                </TouchableOpacity>
              )}

              {tripStatus === "in_progress" && (
                <TouchableOpacity
                  style={[
                    styles.actionButtonPrimary,
                    completingTrip && styles.actionButtonDisabled,
                  ]}
                  onPress={handleCompleteTrip}
                  disabled={completingTrip}
                >
                  <Ionicons name="flag" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>
                    {completingTrip ? "Procesando..." : "Completar"}
                  </Text>
                </TouchableOpacity>
              )}

              {!rideCompleted && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelTrip}
                >
                  <Ionicons name="close" size={20} color="#EF4444" />
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
              )}

              {rideCompleted && (
                <View style={styles.completedContainer}>
                  <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                  <Text style={styles.completedTitle}>¡Completado!</Text>
                  <Text style={styles.completedEarnings}>
                    💰 +{fare.toLocaleString("es-GQ")} XAF
                  </Text>
                </View>
              )}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1F2937",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
  },
  map: {
    flex: 1,
  },
  driverMarkerContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
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
  bottomSheet: {
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
  bottomSheetExpanded: {
    maxHeight: "95%",
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
  },
  collapsedContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  passengerCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  passengerAvatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
  },
  passengerInfoLeft: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  distanceContainer: {
    alignItems: "center",
    gap: 2,
  },
  distanceValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FF6B35",
  },
  distanceLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  distanceAlert: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#FF6B35",
  },
  distanceAlertText: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  distanceAlertValue: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  statusBadgeContainer: {
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  pinInputContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pinInputLabel: {
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
  pinVerifyButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  pinVerifyButtonDisabled: {
    opacity: 0.5,
  },
  bottomSheetWithPin: {
    maxHeight: "75%",
    paddingBottom: 20, // espacio sobre los tabs
  },
  pinVerifyText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  actionButtonPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    backgroundColor: "#FF6B35",
    borderRadius: 10,
    marginBottom: 10,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  cancelButtonCollapsed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
  },
  cancelButtonCollapsedText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#EF4444",
  },
  expandedContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
  },
  passengerDetailCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    gap: 12,
  },
  largeAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
  },
  passengerDetails: {
    flex: 1,
    justifyContent: "space-between",
  },
  detailName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  passengerEmail: {
    fontSize: 12,
    color: "#6B7280",
    marginVertical: 2,
  },
  passengerPhone: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  detailActions: {
    flexDirection: "row",
    gap: 10,
  },
  detailActionButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  routeInfo: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  routeItem: {
    flexDirection: "row",
    gap: 10,
  },
  routeItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFE5CC",
    justifyContent: "center",
    alignItems: "center",
  },
  routeItemText: {
    flex: 1,
  },
  routeItemLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "600",
    marginBottom: 2,
  },
  routeItemName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1F2937",
  },
  routeLine: {
    height: 20,
    width: 2,
    backgroundColor: "#E5E7EB",
    marginLeft: 15,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  detailItem: {
    width: "48%",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  fareHighlight: {
    backgroundColor: "#10B981",
  },
  detailItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  fareIconHighlight: {
    backgroundColor: "#059669",
  },
  detailItemLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  detailItemValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  fareValueHighlight: {
    color: "#fff",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#EF4444",
  },
  completedContainer: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
  },
  completedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  completedEarnings: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
  },
});
