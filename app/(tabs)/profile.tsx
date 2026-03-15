import { auth, db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface DriverProfile {
  fullName: string;
  email: string;
  phone: string;
  rating: number;
  totalTrips: number;
  totalEarnings: number;
  balance: number;
  isOnline: boolean;
  isVerified: boolean;
  vehicle: {
    brand: string;
    model: string;
    color: string;
    year: string;
    licensePlate: string;
  };
  verificationStatus: {
    personalInfo: string;
    vehicle: string;
    documents: string;
  };
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingOnline, setTogglingOnline] = useState(false);

  // Escuchar perfil en tiempo real
  useEffect(() => {
    if (!user) return;

    const driverRef = doc(db, "drivers", user.uid);
    const unsubscribe = onSnapshot(driverRef, (snapshot) => {
      const data = snapshot.data();
      if (data) {
        setProfile(data as DriverProfile);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleToggleOnline = async () => {
    if (!user || !profile) return;
    setTogglingOnline(true);
    try {
      await updateDoc(doc(db, "drivers", user.uid), {
        isOnline: !profile.isOnline,
        isAvailable: !profile.isOnline,
        lastStatusChange: new Date(),
      });
    } catch (error) {
      console.error("Error:", error);
    }
    setTogglingOnline(false);
  };

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro de que quieres salir?", [
      { text: "No" },
      {
        text: "Sí, salir",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace("/(auth)/login");
          } catch (error) {
            console.error("Error cerrando sesión:", error);
          }
        },
      },
    ]);
  };

  const getVerificationColor = (status: string) => {
    if (status === "verified") return "#10B981";
    if (status === "pending") return "#FBBF24";
    return "#EF4444";
  };

  const getVerificationLabel = (status: string) => {
    if (status === "verified") return "Verificado";
    if (status === "pending") return "Pendiente";
    return "Rechazado";
  };

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const acceptanceRate =
    profile.totalTrips > 0
      ? Math.round((profile.totalTrips / (profile.totalTrips + 1)) * 100)
      : 100;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mi Perfil</Text>
        </View>

        {/* Avatar + Info principal */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={40} color="#FF6B35" />
            <View
              style={[
                styles.onlineBadge,
                { backgroundColor: profile.isOnline ? "#10B981" : "#6B7280" },
              ]}
            />
          </View>

          <Text style={styles.profileName}>{profile.fullName}</Text>
          <Text style={styles.profileEmail}>{profile.email}</Text>
          <Text style={styles.profilePhone}>📞 {profile.phone}</Text>

          {/* Rating */}
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={
                  star <= Math.round(profile.rating) ? "star" : "star-outline"
                }
                size={20}
                color="#FBBF24"
              />
            ))}
            <Text style={styles.ratingValue}>{profile.rating.toFixed(1)}</Text>
          </View>
        </View>

        {/* Estado Online */}
        <View style={styles.section}>
          <View style={styles.onlineToggleCard}>
            <View style={styles.onlineToggleLeft}>
              <View
                style={[
                  styles.onlineIndicator,
                  { backgroundColor: profile.isOnline ? "#10B981" : "#6B7280" },
                ]}
              />
              <View>
                <Text style={styles.onlineToggleTitle}>
                  {profile.isOnline ? "En línea" : "Fuera de línea"}
                </Text>
                <Text style={styles.onlineToggleSubtitle}>
                  {profile.isOnline
                    ? "Estás recibiendo solicitudes"
                    : "No recibes solicitudes"}
                </Text>
              </View>
            </View>
            <Switch
              value={profile.isOnline}
              onValueChange={handleToggleOnline}
              disabled={togglingOnline}
              trackColor={{ false: "#374151", true: "#FF6B35" }}
              thumbColor={profile.isOnline ? "#fff" : "#9CA3AF"}
            />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estadísticas</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="car" size={22} color="#FF6B35" />
              <Text style={styles.statValue}>{profile.totalTrips}</Text>
              <Text style={styles.statLabel}>Viajes</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="star" size={22} color="#FBBF24" />
              <Text style={styles.statValue}>{profile.rating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Valoración</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              <Text style={styles.statValue}>{acceptanceRate}%</Text>
              <Text style={styles.statLabel}>Aceptación</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="cash" size={22} color="#FF6B35" />
              <Text style={[styles.statValue, { fontSize: 14 }]}>
                {profile.totalEarnings.toLocaleString("es-GQ")}
              </Text>
              <Text style={styles.statLabel}>XAF ganados</Text>
            </View>
          </View>
        </View>

        {/* Balance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Balance</Text>
          <View
            style={[
              styles.balanceCard,
              profile.balance < 500 && styles.balanceCardLow,
            ]}
          >
            <View style={styles.balanceLeft}>
              <Ionicons
                name="wallet"
                size={24}
                color={profile.balance < 500 ? "#EF4444" : "#FF6B35"}
              />
              <View>
                <Text style={styles.balanceLabel}>Saldo disponible</Text>
                <Text
                  style={[
                    styles.balanceValue,
                    profile.balance < 500 && { color: "#EF4444" },
                  ]}
                >
                  {profile.balance.toLocaleString("es-GQ")} XAF
                </Text>
              </View>
            </View>
            {profile.balance < 500 && (
              <View style={styles.lowBalanceBadge}>
                <Ionicons name="warning" size={14} color="#FEF3C7" />
                <Text style={styles.lowBalanceText}>Bajo</Text>
              </View>
            )}
          </View>
          {profile.balance < 500 && (
            <Text style={styles.balanceHint}>
              Contacta a Yakoo para recargar tu balance
            </Text>
          )}
        </View>

        {/* Vehículo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mi Vehículo</Text>
          <View style={styles.vehicleCard}>
            <View style={styles.vehicleIconContainer}>
              <Ionicons name="car" size={32} color="#FF6B35" />
            </View>
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleName}>
                {profile.vehicle.brand} {profile.vehicle.model}
              </Text>
              <Text style={styles.vehicleDetail}>
                {profile.vehicle.color} • {profile.vehicle.year}
              </Text>
              <View style={styles.licensePlateContainer}>
                <Text style={styles.licensePlate}>
                  {profile.vehicle.licensePlate}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Verificación */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado de Verificación</Text>
          <View style={styles.verificationCard}>
            {[
              {
                label: "Información Personal",
                key: "personalInfo",
                icon: "person-outline",
              },
              {
                label: "Vehículo",
                key: "vehicle",
                icon: "car-outline",
              },
              {
                label: "Documentos",
                key: "documents",
                icon: "document-text-outline",
              },
            ].map((item) => {
              const status =
                profile.verificationStatus?.[
                  item.key as keyof typeof profile.verificationStatus
                ] || "pending";
              return (
                <View key={item.key} style={styles.verificationRow}>
                  <Ionicons name={item.icon as any} size={20} color="#9CA3AF" />
                  <Text style={styles.verificationLabel}>{item.label}</Text>
                  <View
                    style={[
                      styles.verificationBadge,
                      {
                        backgroundColor: getVerificationColor(status) + "20",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.verificationBadgeText,
                        { color: getVerificationColor(status) },
                      ]}
                    >
                      {getVerificationLabel(status)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Menú opciones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color="#9CA3AF"
              />
              <Text style={styles.menuItemText}>Notificaciones</Text>
              <Ionicons name="chevron-forward" size={16} color="#6B7280" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="help-circle-outline" size={20} color="#9CA3AF" />
              <Text style={styles.menuItemText}>Soporte Yakoo</Text>
              <Ionicons name="chevron-forward" size={16} color="#6B7280" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color="#9CA3AF"
              />
              <Text style={styles.menuItemText}>Términos y condiciones</Text>
              <Ionicons name="chevron-forward" size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  profileCard: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: "#1F2937",
    marginHorizontal: 20,
    borderRadius: 20,
    marginBottom: 24,
    gap: 8,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FF6B3520",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FF6B35",
    marginBottom: 4,
  },
  onlineBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#1F2937",
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },
  profileEmail: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  profilePhone: {
    fontSize: 13,
    color: "#6B7280",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  ratingValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FBBF24",
    marginLeft: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  onlineToggleCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 16,
  },
  onlineToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  onlineIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  onlineToggleTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  onlineToggleSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "47%",
    backgroundColor: "#1F2937",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  statLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  balanceCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  balanceCardLow: {
    borderColor: "rgba(239,68,68,0.3)",
  },
  balanceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  balanceLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FF6B35",
  },
  lowBalanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239,68,68,0.2)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lowBalanceText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#EF4444",
  },
  balanceHint: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 8,
    textAlign: "center",
  },
  vehicleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  vehicleIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FF6B3520",
    justifyContent: "center",
    alignItems: "center",
  },
  vehicleInfo: {
    flex: 1,
    gap: 4,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  vehicleDetail: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  licensePlateContainer: {
    backgroundColor: "#111827",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#374151",
  },
  licensePlate: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 1,
  },
  verificationCard: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 4,
  },
  verificationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  verificationLabel: {
    flex: 1,
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
  },
  verificationBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  verificationBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  menuCard: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuItemText: {
    flex: 1,
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#111827",
    marginHorizontal: 16,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#EF4444",
  },
});
