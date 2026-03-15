import { Ionicons } from "@expo/vector-icons";
import React from "react";

import {
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";

interface RideNotification {
  rideId: string;
  userId: string;
  userEmail: string;
  userPhone?: string;
  pickup: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  destination: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  vehicleType: string;
  distance: number;
  estimatedPrice: number;
  createdAt: any;
}

interface RideNotificationModalProps {
  visible: boolean;
  notification: RideNotification | null;
  onAccept: (notification: RideNotification) => Promise<void>;
  onReject: (notification: RideNotification) => Promise<void>;
  loading?: boolean;
}

export const RideNotificationModal = ({
  visible,
  notification,
  onAccept,
  onReject,
  loading = false,
}: RideNotificationModalProps) => {
  const [scaleAnim] = React.useState(new Animated.Value(0));
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      // Vibración cuando llega notificación
      Vibration.vibrate([0, 50, 100, 50]);

      // Animación de entrada
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    } else {
      // Reset animación
      scaleAnim.setValue(0);
    }
  }, [visible]);

  const handleAccept = async () => {
    if (!notification) return;

    try {
      setIsLoading(true);
      await onAccept(notification);
      // Navigation will be handled by the caller after this
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      Alert.alert("Error", "No se pudo aceptar el viaje");
    }
  };

  const handleReject = async () => {
    if (!notification) return;

    try {
      setIsLoading(true);
      await onReject(notification);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      Alert.alert("Error", "No se pudo rechazar el viaje");
    }
  };

  if (!notification) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      pointerEvents="box-none"
    >
      {/* Overlay oscuro */}
      <View style={styles.overlay}>
        {/* Card animado */}
        <Animated.View
          style={[
            styles.container,
            {
              transform: [
                {
                  scale: scaleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Header con ícono de notificación */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="car" size={32} color="#fff" />
            </View>
            <Text style={styles.headerTitle}>🎉 Nueva Solicitud</Text>
          </View>

          {/* Información del viaje */}
          <ScrollView
            style={{ flexShrink: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {/* Origen y destino */}
            <View style={styles.routeContainer}>
              {/* Origen */}
              <View style={styles.routeItem}>
                <View style={styles.routeDot} />
                <View style={styles.routeTextContainer}>
                  <Text style={styles.routeLabel}>Origen</Text>
                  <Text style={styles.routeName}>
                    {notification.pickup.name}
                  </Text>
                  <Text style={styles.routeAddress}>
                    {notification.pickup.address}
                  </Text>
                </View>
              </View>

              {/* Línea conectora */}
              <View style={styles.routeLine} />

              {/* Destino */}
              <View style={styles.routeItem}>
                <View style={[styles.routeDot, styles.routeDotDestination]} />
                <View style={styles.routeTextContainer}>
                  <Text style={styles.routeLabel}>Destino</Text>
                  <Text style={styles.routeName}>
                    {notification.destination.name}
                  </Text>
                  <Text style={styles.routeAddress}>
                    {notification.destination.address}
                  </Text>
                </View>
              </View>
            </View>

            {/* Información del viaje */}
            <View style={styles.detailsContainer}>
              {/* Distancia */}
              <View style={styles.detailItem}>
                <Ionicons name="navigate" size={20} color="#FF6B35" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Distancia</Text>
                  <Text style={styles.detailValue}>
                    {notification.distance.toFixed(1)} km
                  </Text>
                </View>
              </View>

              {/* Tipo de vehículo */}
              <View style={styles.detailItem}>
                <Ionicons name="car-outline" size={20} color="#FF6B35" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Tipo de Viaje</Text>
                  <Text style={styles.detailValue}>
                    {notification.vehicleType}
                  </Text>
                </View>
              </View>

              {/* Precio estimado */}
              <View style={styles.detailItem}>
                <Ionicons name="cash" size={20} color="#FF6B35" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Tarifa Estimada</Text>
                  <Text style={styles.detailValue}>
                    {notification.estimatedPrice.toLocaleString("es-GQ")} XAF
                  </Text>
                </View>
              </View>
            </View>

            {/* Información del usuario */}
            <View style={styles.userInfoContainer}>
              <Text style={styles.userLabel}>Datos del Pasajero</Text>
              <View style={styles.userInfo}>
                <View style={styles.userAvatar}>
                  <Ionicons name="person" size={20} color="#fff" />
                </View>
                <View style={styles.userTextContainer}>
                  <Text style={styles.userEmail}>{notification.userEmail}</Text>
                  {notification.userPhone && (
                    <Text style={styles.userPhone}>
                      {notification.userPhone}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={handleReject}
              disabled={isLoading}
            >
              <Ionicons name="close" size={24} color="#EF4444" />
              <Text style={styles.rejectButtonText}>Rechazar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAccept}
              disabled={isLoading}
            >
              {isLoading ? (
                <Ionicons name="hourglass" size={24} color="#fff" />
              ) : (
                <Ionicons name="checkmark" size={24} color="#fff" />
              )}
              <Text style={styles.acceptButtonText}>
                {isLoading ? "Procesando..." : "Aceptar"}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
    paddingBottom: 20,
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginHorizontal: 12,
    overflow: "hidden",
    maxHeight: "90%", // ← sube un poco
    flexShrink: 1, // ← agrega esto
  },
  header: {
    backgroundColor: "#FF6B35",
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  content: {
    padding: 20,
  },
  routeContainer: {
    marginBottom: 24,
  },
  routeItem: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF6B35",
    marginTop: 4,
  },
  routeDotDestination: {
    backgroundColor: "#10B981",
  },
  routeTextContainer: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 2,
  },
  routeName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 12,
    color: "#6B7280",
  },
  routeLine: {
    width: 2,
    height: 30,
    backgroundColor: "#E5E7EB",
    marginLeft: 5,
    marginBottom: 8,
  },
  detailsContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  userInfoContainer: {
    marginBottom: 20,
  },
  userLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
  },
  userTextContainer: {
    flex: 1,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 12,
    color: "#6B7280",
  },
  actionContainer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    gap: 8,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#EF4444",
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    gap: 8,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
