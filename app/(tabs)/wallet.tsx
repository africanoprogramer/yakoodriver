import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getEarningsHistory } from "@/utils/earningsService";
import { Ionicons } from "@expo/vector-icons";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  note?: string;
  requestedAt: any;
  processedAt?: any;
  rejectionReason?: string;
}

const STATUS_CFG = {
  pending:  { label: "Pendiente",  color: "#F2AB30", bg: "#2D2010" },
  approved: { label: "Aprobado",   color: "#10B981", bg: "#064E3B" },
  rejected: { label: "Rechazado",  color: "#EF4444", bg: "#450A0A" },
};

export default function WalletScreen() {
  const { user } = useAuth();
  const [balance, setBalance]               = useState(0);
  const [driverName, setDriverName]         = useState("");
  const [driverPhone, setDriverPhone]       = useState("");
  const [totalEarnings, setTotalEarnings]   = useState(0);
  const [totalTrips, setTotalTrips]         = useState(0);
  const [earnings, setEarnings]             = useState<EarningRecord[]>([]);
  const [withdrawals, setWithdrawals]       = useState<WithdrawalRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing]         = useState(false);

  // Modal
  const [showModal, setShowModal]   = useState(false);
  const [amount, setAmount]         = useState("");
  const [note, setNote]             = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Balance en tiempo real ──
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "drivers", user.uid), (snap) => {
      const d = snap.data();
      if (!d) return;
      setBalance(d.balance || 0);
      setTotalEarnings(d.totalEarnings || 0);
      setTotalTrips(d.totalTrips || 0);
      setDriverName(d.fullName || "");
      setDriverPhone(d.phone || "");
    });
  }, [user]);

  // ── Solicitudes de retiro en tiempo real ──
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "driver_withdrawal_requests"),
      where("driverId", "==", user.uid),
      orderBy("requestedAt", "desc"),
    );
    return onSnapshot(q, (snap) => {
      setWithdrawals(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WithdrawalRequest),
      );
    });
  }, [user]);

  // ── Historial de viajes ──
  const loadHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    const result = await getEarningsHistory(user.uid, 20);
    if (result.success && result.earnings) {
      setEarnings(result.earnings as EarningRecord[]);
    }
    setLoadingHistory(false);
  };

  useEffect(() => { loadHistory(); }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  // ── Solicitar retiro ──
  const handleRequestWithdrawal = async () => {
    const parsed = parseInt(amount.replace(/\D/g, ""), 10);
    if (!parsed || parsed <= 0) {
      Alert.alert("Importe inválido", "Ingresa un importe mayor que 0.");
      return;
    }
    if (parsed > balance) {
      Alert.alert(
        "Saldo insuficiente",
        `Tu balance es ${balance.toLocaleString("es-GQ")} XAF.`,
      );
      return;
    }
    const hasPending = withdrawals.some((w) => w.status === "pending");
    if (hasPending) {
      Alert.alert(
        "Solicitud en curso",
        "Ya tienes una solicitud pendiente. Espera a que el admin la procese.",
      );
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "driver_withdrawal_requests"), {
        driverId: user!.uid,
        driverName,
        driverPhone,
        amount: parsed,
        note: note.trim(),
        status: "pending",
        requestedAt: serverTimestamp(),
      });
      setShowModal(false);
      setAmount("");
      setNote("");
      Alert.alert("✅ Solicitud enviada", "El admin la revisará pronto.");
    } catch (e) {
      Alert.alert("Error", "No se pudo enviar la solicitud. Inténtalo de nuevo.");
    }
    setSubmitting(false);
  };

  const fmtDate = (ts: any) => {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleDateString("es-GQ", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const renderEarningItem = ({ item }: { item: EarningRecord }) => (
    <View style={st.earningItem}>
      <View style={st.earningIcon}>
        <Ionicons name="car" size={20} color="#FF6B35" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.earningTitle}>Viaje completado</Text>
        <Text style={st.earningDate}>{fmtDate(item.completedAt)}</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Text style={st.earningFare}>
            Tarifa: {(item.fare || 0).toLocaleString("es-GQ")} XAF
          </Text>
          <Text style={st.earningCommission}>
            Comisión: -{(item.commission || 0).toLocaleString("es-GQ")} XAF
          </Text>
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={st.earningAmount}>
          +{(item.driverEarnings || 0).toLocaleString("es-GQ")}
        </Text>
        <Text style={st.earningCurrency}>XAF</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />
        }
      >
        <View style={st.header}>
          <Text style={st.headerTitle}>Mi Wallet</Text>
        </View>

        {/* ── Balance card ── */}
        <View style={st.balanceCard}>
          <Text style={st.balanceLbl}>Balance disponible</Text>
          <Text style={[st.balanceAmt, balance < 500 && { color: "#FCA5A5" }]}>
            {balance.toLocaleString("es-GQ")} XAF
          </Text>

          {balance < 500 && (
            <View style={st.lowWarn}>
              <Ionicons name="warning" size={15} color="#FEF3C7" />
              <Text style={st.lowWarnTxt}>
                Balance bajo — contacta a Yakoo para recargar
              </Text>
            </View>
          )}

          {/* Botón retiro */}
          <TouchableOpacity
            style={st.withdrawBtn}
            onPress={() => setShowModal(true)}
          >
            <Ionicons name="arrow-up-circle" size={20} color="#FF6B35" />
            <Text style={st.withdrawBtnTxt}>Solicitar retiro</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats ── */}
        <View style={st.statsRow}>
          <View style={st.statCard}>
            <Ionicons name="cash-outline" size={24} color="#FF6B35" />
            <Text style={st.statVal}>{totalEarnings.toLocaleString("es-GQ")}</Text>
            <Text style={st.statLbl}>XAF ganados</Text>
          </View>
          <View style={st.statCard}>
            <Ionicons name="car-outline" size={24} color="#FF6B35" />
            <Text style={st.statVal}>{totalTrips}</Text>
            <Text style={st.statLbl}>Viajes</Text>
          </View>
          <View style={st.statCard}>
            <Ionicons name="trending-up-outline" size={24} color="#FF6B35" />
            <Text style={st.statVal}>
              {totalTrips > 0
                ? Math.round(totalEarnings / totalTrips).toLocaleString("es-GQ")
                : "0"}
            </Text>
            <Text style={st.statLbl}>XAF / viaje</Text>
          </View>
        </View>

        {/* ── Comisión ── */}
        <View style={st.commCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Ionicons name="pie-chart-outline" size={20} color="#FF6B35" />
            <Text style={st.commTitle}>Estructura de pagos</Text>
          </View>
          <View style={st.commBar}>
            <View style={[st.commFill, { flex: 9 }]} />
            <View style={[st.commYakoo, { flex: 1 }]} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
            {[
              { color: "#FF6B35", label: "Tu ganancia: 90%" },
              { color: "#374151", label: "Comisión Yakoo: 10%" },
            ].map((l) => (
              <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[st.legendDot, { backgroundColor: l.color }]} />
                <Text style={st.legendTxt}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Mis solicitudes de retiro ── */}
        {withdrawals.length > 0 && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Solicitudes de retiro</Text>
            {withdrawals.map((w) => {
              const cfg = STATUS_CFG[w.status];
              return (
                <View key={w.id} style={st.withdrawItem}>
                  <View style={[st.withdrawStatusDot, { backgroundColor: cfg.bg }]}>
                    <Ionicons
                      name={
                        w.status === "approved"
                          ? "checkmark-circle"
                          : w.status === "rejected"
                          ? "close-circle"
                          : "time"
                      }
                      size={20}
                      color={cfg.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.withdrawAmt}>
                      {w.amount.toLocaleString("es-GQ")} XAF
                    </Text>
                    <Text style={st.withdrawDate}>{fmtDate(w.requestedAt)}</Text>
                    {w.rejectionReason ? (
                      <Text style={st.withdrawReason}>
                        Motivo: {w.rejectionReason}
                      </Text>
                    ) : null}
                    {w.note ? (
                      <Text style={st.withdrawNote}>Nota: {w.note}</Text>
                    ) : null}
                  </View>
                  <View style={[st.statusChip, { backgroundColor: cfg.bg }]}>
                    <Text style={[st.statusChipTxt, { color: cfg.color }]}>
                      {cfg.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Historial viajes ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Historial de viajes</Text>
          {loadingHistory ? (
            <ActivityIndicator color="#FF6B35" size="large" style={{ marginTop: 40 }} />
          ) : earnings.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 50, gap: 12 }}>
              <Ionicons name="receipt-outline" size={48} color="#374151" />
              <Text style={{ fontSize: 15, color: "#6B7280", fontWeight: "600" }}>
                Sin viajes completados aún
              </Text>
            </View>
          ) : (
            <FlatList
              data={earnings}
              renderItem={renderEarningItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "#1F2937" }} />}
            />
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ══ MODAL SOLICITAR RETIRO ══ */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={modal.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowModal(false)} />
          <View style={modal.sheet}>
            <View style={modal.handle} />
            <Text style={modal.title}>Solicitar retiro</Text>
            <Text style={modal.sub}>
              Balance disponible:{" "}
              <Text style={{ color: "#FF6B35", fontWeight: "700" }}>
                {balance.toLocaleString("es-GQ")} XAF
              </Text>
            </Text>

            <Text style={modal.label}>Importe a retirar (XAF)</Text>
            <TextInput
              style={modal.input}
              placeholder="Ej: 5000"
              placeholderTextColor="#4B5563"
              keyboardType="numeric"
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/\D/g, ""))}
            />

            <Text style={modal.label}>Nota (opcional)</Text>
            <TextInput
              style={[modal.input, { minHeight: 60 }]}
              placeholder="Ej: número de cuenta o indicaciones..."
              placeholderTextColor="#4B5563"
              value={note}
              onChangeText={setNote}
              multiline
            />

            <TouchableOpacity
              style={[modal.btn, submitting && { opacity: 0.6 }]}
              onPress={handleRequestWithdrawal}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={modal.btnTxt}>Enviar solicitud</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={modal.cancelBtn}
              onPress={() => setShowModal(false)}
            >
              <Text style={modal.cancelTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#fff" },

  balanceCard: {
    backgroundColor: "#FF6B35",
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    gap: 10,
  },
  balanceLbl: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  balanceAmt: { fontSize: 40, fontWeight: "700", color: "#fff" },
  lowWarn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.3)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lowWarnTxt: { fontSize: 12, fontWeight: "600", color: "#FEF3C7", flex: 1 },

  withdrawBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  withdrawBtnTxt: { fontSize: 15, fontWeight: "800", color: "#FF6B35" },

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
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  statVal: { fontSize: 16, fontWeight: "700", color: "#fff" },
  statLbl: { fontSize: 10, color: "#9CA3AF", fontWeight: "600", textAlign: "center" },

  commCard: {
    backgroundColor: "#1F2937",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  commTitle: { fontSize: 14, fontWeight: "700", color: "#fff" },
  commBar: { height: 12, borderRadius: 6, flexDirection: "row", overflow: "hidden" },
  commFill: { backgroundColor: "#FF6B35" },
  commYakoo: { backgroundColor: "#374151" },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTxt: { fontSize: 12, color: "#9CA3AF", fontWeight: "600" },

  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 14 },

  withdrawItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1F2937",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  withdrawStatusDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  withdrawAmt: { fontSize: 16, fontWeight: "700", color: "#fff" },
  withdrawDate: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  withdrawReason: { fontSize: 11, color: "#EF4444", marginTop: 2 },
  withdrawNote: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  statusChip: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  statusChipTxt: { fontSize: 12, fontWeight: "700" },

  earningItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 12,
  },
  earningIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
  },
  earningTitle: { fontSize: 14, fontWeight: "700", color: "#fff", marginBottom: 2 },
  earningDate: { fontSize: 12, color: "#6B7280", marginBottom: 4 },
  earningFare: { fontSize: 11, color: "#9CA3AF" },
  earningCommission: { fontSize: 11, color: "#EF4444" },
  earningAmount: { fontSize: 18, fontWeight: "700", color: "#10B981" },
  earningCurrency: { fontSize: 11, color: "#6B7280", fontWeight: "600" },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1F2937",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#374151",
    alignSelf: "center",
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: "800", color: "#fff" },
  sub: { fontSize: 14, color: "#9CA3AF" },
  label: { fontSize: 13, fontWeight: "600", color: "#9CA3AF", marginTop: 4 },
  input: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#374151",
  },
  btn: {
    backgroundColor: "#FF6B35",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  btnTxt: { fontSize: 16, fontWeight: "800", color: "#fff" },
  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelTxt: { fontSize: 14, color: "#6B7280", fontWeight: "600" },
});
