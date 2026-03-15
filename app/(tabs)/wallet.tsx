import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getEarningsHistory } from "@/utils/earningsService";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface EarningRecord {
  id: string;
  fare: number;
  commission: number;
  driverEarnings: number;
  paymentMethod: string;
  status: string;
  completedAt: any;
  rideId: string;
}

export default function WalletScreen() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalTrips, setTotalTrips] = useState(0);
  const [earnings, setEarnings] = useState<EarningRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Escuchar balance en tiempo real
  useEffect(() => {
    if (!user) return;

    const driverRef = doc(db, "drivers", user.uid);
    const unsubscribe = onSnapshot(driverRef, (snapshot) => {
      const data = snapshot.data();
      if (data) {
        setBalance(data.balance || 0);
        setTotalEarnings(data.totalEarnings || 0);
        setTotalTrips(data.totalTrips || 0);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Cargar historial
  const loadHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    const result = await getEarningsHistory(user.uid, 20);
    if (result.success && result.earnings) {
      setEarnings(result.earnings as EarningRecord[]);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    loadHistory();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

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

  const renderEarningItem = ({ item }: { item: EarningRecord }) => (
    <View style={styles.earningItem}>
      <View style={styles.earningIconContainer}>
        <Ionicons name="car" size={20} color="#FF6B35" />
      </View>
      <View style={styles.earningInfo}>
        <Text style={styles.earningTitle}>Viaje completado</Text>
        <Text style={styles.earningDate}>{formatDate(item.completedAt)}</Text>
        <View style={styles.earningBreakdown}>
          <Text style={styles.earningFare}>
            Tarifa: {(item.fare || 0).toLocaleString("es-GQ")} XAF
          </Text>
          <Text style={styles.earningCommission}>
            Comisión: -{(item.commission || 0).toLocaleString("es-GQ")} XAF
          </Text>
        </View>
      </View>
      <View style={styles.earningAmountContainer}>
        <Text style={styles.earningAmount}>
          +{(item.driverEarnings || 0).toLocaleString("es-GQ")}
        </Text>
        <Text style={styles.earningCurrency}>XAF</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mi Wallet</Text>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Balance disponible</Text>
          <Text
            style={[
              styles.balanceAmount,
              { color: balance < 500 ? "#EF4444" : "#fff" },
            ]}
          >
            {balance.toLocaleString("es-GQ")} XAF
          </Text>

          {balance < 500 && (
            <View style={styles.lowBalanceWarning}>
              <Ionicons name="warning" size={16} color="#FEF3C7" />
              <Text style={styles.lowBalanceText}>
                Balance bajo — contacta a Yakoo para recargar
              </Text>
            </View>
          )}

          {/* Cómo recargar */}
          <View style={styles.rechargeInfo}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="#9CA3AF"
            />
            <Text style={styles.rechargeInfoText}>
              Para recargar tu balance, contacta al soporte de Yakoo
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={24} color="#FF6B35" />
            <Text style={styles.statValue}>
              {totalEarnings.toLocaleString("es-GQ")}
            </Text>
            <Text style={styles.statLabel}>XAF ganados</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="car-outline" size={24} color="#FF6B35" />
            <Text style={styles.statValue}>{totalTrips}</Text>
            <Text style={styles.statLabel}>Viajes</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="trending-up-outline" size={24} color="#FF6B35" />
            <Text style={styles.statValue}>
              {totalTrips > 0
                ? Math.round(totalEarnings / totalTrips).toLocaleString("es-GQ")
                : "0"}
            </Text>
            <Text style={styles.statLabel}>XAF / viaje</Text>
          </View>
        </View>

        {/* Comisión info */}
        <View style={styles.commissionCard}>
          <View style={styles.commissionHeader}>
            <Ionicons name="pie-chart-outline" size={20} color="#FF6B35" />
            <Text style={styles.commissionTitle}>Estructura de pagos</Text>
          </View>
          <View style={styles.commissionRow}>
            <View style={styles.commissionBar}>
              <View style={[styles.commissionFill, { flex: 9 }]} />
              <View style={[styles.commissionYakoo, { flex: 1 }]} />
            </View>
          </View>
          <View style={styles.commissionLegend}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#FF6B35" }]}
              />
              <Text style={styles.legendText}>Tu ganancia: 90%</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#E5E7EB" }]}
              />
              <Text style={styles.legendText}>Comisión Yakoo: 10%</Text>
            </View>
          </View>
        </View>

        {/* Historial */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Historial de viajes</Text>

          {loadingHistory ? (
            <ActivityIndicator
              size="large"
              color="#FF6B35"
              style={{ marginTop: 40 }}
            />
          ) : earnings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color="#374151" />
              <Text style={styles.emptyText}>Sin viajes completados aún</Text>
            </View>
          ) : (
            <FlatList
              data={earnings}
              renderItem={renderEarningItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  balanceCard: {
    backgroundColor: "#FF6B35",
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  lowBalanceWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.3)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  lowBalanceText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FEF3C7",
    flex: 1,
  },
  rechargeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  rechargeInfoText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  statLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "600",
    textAlign: "center",
  },
  commissionCard: {
    backgroundColor: "#1F2937",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  commissionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  commissionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  commissionRow: {
    marginBottom: 12,
  },
  commissionBar: {
    height: 12,
    borderRadius: 6,
    flexDirection: "row",
    overflow: "hidden",
  },
  commissionFill: {
    backgroundColor: "#FF6B35",
  },
  commissionYakoo: {
    backgroundColor: "#374151",
  },
  commissionLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  historySection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "600",
  },
  earningItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 12,
  },
  earningIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
  },
  earningInfo: {
    flex: 1,
  },
  earningTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  earningDate: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  earningBreakdown: {
    flexDirection: "row",
    gap: 12,
  },
  earningFare: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  earningCommission: {
    fontSize: 11,
    color: "#EF4444",
  },
  earningAmountContainer: {
    alignItems: "flex-end",
  },
  earningAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10B981",
  },
  earningCurrency: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },
  separator: {
    height: 1,
    backgroundColor: "#1F2937",
  },
});
