import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface RideRecord {
  id: string;
  status: "completed" | "cancelled";
  cancelledBy?: string;
  cancelReason?: string;
  fare?: number;
  commission?: number;
  driverEarnings?: number;
  distance?: number;
  vehicleType?: string;
  pickup?: { name: string };
  destination?: { name: string };
  userEmail?: string;
  completedAt?: any;
  cancelledAt?: any;
  createdAt?: any;
}

type FilterType = "all" | "completed" | "cancelled";

export default function ActivityScreen() {
  const { user } = useAuth();
  const [rides, setRides] = useState<RideRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [stats, setStats] = useState({
    totalTrips: 0,
    completedTrips: 0,
    cancelledTrips: 0,
    totalEarnings: 0,
  });

  const loadActivity = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Cargar rides del conductor desde la colección rides
      const ridesRef = collection(db, "rides");
      const q = query(ridesRef, orderBy("createdAt", "desc"), limit(50));
      const snapshot = await getDocs(q);

      // Filtrar solo los viajes de este conductor
      const allRides: RideRecord[] = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }) as RideRecord)
        .filter(
          (ride: any) =>
            ride.acceptedBy === user.uid || ride.driverId === user.uid,
        );

      setRides(allRides);

      // Calcular stats
      const completed = allRides.filter((r) => r.status === "completed");
      const cancelled = allRides.filter((r) => r.status === "cancelled");
      const totalEarnings = completed.reduce(
        (sum, r) => sum + (r.driverEarnings || 0),
        0,
      );

      setStats({
        totalTrips: allRides.length,
        completedTrips: completed.length,
        cancelledTrips: cancelled.length,
        totalEarnings,
      });
    } catch (error) {
      console.error("Error cargando actividad:", error);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadActivity();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActivity();
    setRefreshing(false);
  };

  const filteredRides = rides.filter((ride) => {
    if (filter === "all") return true;
    return ride.status === filter;
  });

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("es-GQ", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimestamp = (ride: RideRecord) => {
    return ride.completedAt || ride.cancelledAt || ride.createdAt;
  };

  const renderRideItem = ({ item }: { item: RideRecord }) => {
    const isCompleted = item.status === "completed";
    const isCancelledByMe = item.cancelledBy === "driver";

    return (
      <View style={styles.rideCard}>
        {/* Header */}
        <View style={styles.rideCardHeader}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isCompleted ? "#10B981" : "#EF4444" },
            ]}
          />
          <View style={styles.rideCardHeaderInfo}>
            <Text style={styles.rideStatus}>
              {isCompleted
                ? "✅ Completado"
                : isCancelledByMe
                  ? "❌ Cancelado por ti"
                  : "❌ Cancelado por pasajero"}
            </Text>
            <Text style={styles.rideDate}>
              {formatDate(getTimestamp(item))}
            </Text>
          </View>

          {isCompleted && (
            <View style={styles.earningsTag}>
              <Text style={styles.earningsTagText}>
                +{(item.driverEarnings || 0).toLocaleString("es-GQ")} XAF
              </Text>
            </View>
          )}
        </View>

        {/* Ruta */}
        <View style={styles.routeContainer}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: "#FF6B35" }]} />
            <Text style={styles.routeText} numberOfLines={1}>
              {item.pickup?.name || "Origen desconocido"}
            </Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: "#10B981" }]} />
            <Text style={styles.routeText} numberOfLines={1}>
              {item.destination?.name || "Destino desconocido"}
            </Text>
          </View>
        </View>

        {/* Detalles */}
        <View style={styles.rideDetails}>
          {item.distance && (
            <View style={styles.detailChip}>
              <Ionicons name="navigate-outline" size={12} color="#6B7280" />
              <Text style={styles.detailChipText}>
                {item.distance.toFixed(1)} km
              </Text>
            </View>
          )}
          {item.vehicleType && (
            <View style={styles.detailChip}>
              <Ionicons name="car-outline" size={12} color="#6B7280" />
              <Text style={styles.detailChipText}>{item.vehicleType}</Text>
            </View>
          )}
          {isCompleted && item.fare && (
            <View style={styles.detailChip}>
              <Ionicons name="cash-outline" size={12} color="#6B7280" />
              <Text style={styles.detailChipText}>
                {item.fare.toLocaleString("es-GQ")} XAF
              </Text>
            </View>
          )}
          {!isCompleted && item.cancelReason && (
            <View style={[styles.detailChip, styles.cancelChip]}>
              <Ionicons
                name="information-circle-outline"
                size={12}
                color="#EF4444"
              />
              <Text style={[styles.detailChipText, { color: "#EF4444" }]}>
                {item.cancelReason}
              </Text>
            </View>
          )}
        </View>

        {/* Desglose financiero — solo en completados */}
        {isCompleted && item.commission !== undefined && (
          <View style={styles.financialBreakdown}>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Tarifa cobrada</Text>
              <Text style={styles.financialValue}>
                {(item.fare || 0).toLocaleString("es-GQ")} XAF
              </Text>
            </View>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Comisión Yakoo (10%)</Text>
              <Text style={[styles.financialValue, { color: "#EF4444" }]}>
                -{(item.commission || 0).toLocaleString("es-GQ")} XAF
              </Text>
            </View>
            <View style={[styles.financialRow, styles.financialTotal]}>
              <Text style={styles.financialTotalLabel}>Tu ganancia</Text>
              <Text style={styles.financialTotalValue}>
                {(item.driverEarnings || 0).toLocaleString("es-GQ")} XAF
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Actividad</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalTrips}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, styles.statCardGreen]}>
          <Text style={[styles.statValue, { color: "#10B981" }]}>
            {stats.completedTrips}
          </Text>
          <Text style={styles.statLabel}>Completados</Text>
        </View>
        <View style={[styles.statCard, styles.statCardRed]}>
          <Text style={[styles.statValue, { color: "#EF4444" }]}>
            {stats.cancelledTrips}
          </Text>
          <Text style={styles.statLabel}>Cancelados</Text>
        </View>
        <View style={[styles.statCard, styles.statCardOrange]}>
          <Text style={[styles.statValue, { color: "#FF6B35", fontSize: 14 }]}>
            {stats.totalEarnings.toLocaleString("es-GQ")}
          </Text>
          <Text style={styles.statLabel}>XAF ganados</Text>
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filterRow}>
        {(["all", "completed", "cancelled"] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterButton,
              filter === f && styles.filterButtonActive,
            ]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filter === f && styles.filterButtonTextActive,
              ]}
            >
              {f === "all"
                ? "Todos"
                : f === "completed"
                  ? "Completados"
                  : "Cancelados"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#FF6B35"
          style={{ marginTop: 60 }}
        />
      ) : filteredRides.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={56} color="#374151" />
          <Text style={styles.emptyTitle}>Sin viajes aún</Text>
          <Text style={styles.emptySubtext}>
            {filter === "all"
              ? "Tus viajes aparecerán aquí"
              : filter === "completed"
                ? "No tienes viajes completados"
                : "No tienes viajes cancelados"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRides}
          renderItem={renderRideItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF6B35"
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
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
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statCardGreen: {
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.2)",
  },
  statCardRed: {
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
  },
  statCardOrange: {
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.2)",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  statLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "600",
    textAlign: "center",
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#1F2937",
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: "#FF6B35",
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  filterButtonTextActive: {
    color: "#fff",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingBottom: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  rideCard: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 16,
  },
  rideCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rideCardHeaderInfo: {
    flex: 1,
  },
  rideStatus: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  rideDate: {
    fontSize: 11,
    color: "#6B7280",
  },
  earningsTag: {
    backgroundColor: "rgba(16,185,129,0.15)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  earningsTagText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#10B981",
  },
  routeContainer: {
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  routeConnector: {
    width: 2,
    height: 16,
    backgroundColor: "#374151",
    marginLeft: 3,
    marginVertical: 4,
  },
  rideDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  detailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#111827",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelChip: {
    backgroundColor: "rgba(239,68,68,0.1)",
  },
  detailChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  financialBreakdown: {
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#374151",
    marginTop: 4,
  },
  financialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  financialLabel: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  financialValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  financialTotal: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#374151",
    marginTop: 4,
  },
  financialTotalLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  financialTotalValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#10B981",
  },
});
