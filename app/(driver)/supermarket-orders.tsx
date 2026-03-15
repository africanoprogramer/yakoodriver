// app/(driver)/supermarket-orders.tsx
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
    collection,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ORANGE = "#F2AB30";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  image: string;
}

interface Order {
  id: string;
  supermarketId: string;
  supermarketName: string;
  supermarketColor: string;
  supermarketPhone: string;
  userName: string;
  userPhone: string;
  userAddress: string;
  items: OrderItem[];
  total: number;
  status: "confirmed" | "delivering" | "delivered" | "cancelled";
  notes: string;
  driverId: string;
  createdAt: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS = {
  confirmed: {
    label: "Listo para recoger",
    color: "#1E88E5",
    bg: "#EFF6FF",
    icon: "cube-outline" as const,
  },
  delivering: {
    label: "En camino",
    color: "#9333EA",
    bg: "#FAF5FF",
    icon: "bicycle-outline" as const,
  },
  delivered: {
    label: "Entregado",
    color: "#16A34A",
    bg: "#F0FDF4",
    icon: "checkmark-circle-outline" as const,
  },
  cancelled: {
    label: "Cancelado",
    color: "#DC2626",
    bg: "#FEF2F2",
    icon: "close-circle-outline" as const,
  },
};

const fmtTs = (ts: any) => {
  if (!ts) return "—";
  const d = ts.toDate?.() ?? new Date(ts);
  return (
    d.toLocaleTimeString("es-GQ", { hour: "2-digit", minute: "2-digit" }) +
    " · " +
    d.toLocaleDateString("es-GQ", { day: "numeric", month: "short" })
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function DriverSupermarketOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"available" | "mine" | "done">(
    "available",
  );
  const [selected, setSelected] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Escuchar pedidos confirmados (disponibles) + los que lleva este driver
    const unsub = onSnapshot(
      query(
        collection(db, "supermarket_orders"),
        where("status", "in", ["confirmed", "delivering", "delivered"]),
      ),
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
        all.sort(
          (a, b) =>
            (b.createdAt?.toDate?.()?.getTime() ?? 0) -
            (a.createdAt?.toDate?.()?.getTime() ?? 0),
        );
        setOrders(all);
        setLoading(false);
      },
    );
    return unsub;
  }, [user]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const acceptOrder = async (order: Order) => {
    if (!user) return;
    Alert.alert(
      "¿Aceptar este pedido?",
      `Irás a ${order.supermarketName ?? "el supermercado"} a recogerlo y lo entregarás en:\n\n${order.userAddress}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Aceptar",
          onPress: async () => {
            await updateDoc(doc(db, "supermarket_orders", order.id), {
              status: "delivering",
              driverId: user.uid,
              driverName: user.displayName ?? "Driver",
              acceptedAt: serverTimestamp(),
            });
            setSelected(null);
          },
        },
      ],
    );
  };

  const markDelivered = async (order: Order) => {
    Alert.alert(
      "¿Confirmar entrega?",
      "Marca el pedido como entregado al cliente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Entregado ✅",
          onPress: async () => {
            await updateDoc(doc(db, "supermarket_orders", order.id), {
              status: "delivered",
              deliveredAt: serverTimestamp(),
            });
            setSelected(null);
          },
        },
      ],
    );
  };

  const callPhone = (phone: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const openWhatsApp = (phone: string, name: string) => {
    const clean = phone.replace(/\D/g, "");
    Linking.openURL(
      `https://wa.me/${clean}?text=${encodeURIComponent(`Hola ${name}, soy el repartidor de Yakoo. Voy en camino con tu pedido 🛵`)}`,
    );
  };

  // ── Filtered lists ─────────────────────────────────────────────────────────

  const available = orders.filter(
    (o) => o.status === "confirmed" && !o.driverId,
  );
  const mine = orders.filter(
    (o) => o.status === "delivering" && o.driverId === user?.uid,
  );
  const done = orders.filter(
    (o) => o.status === "delivered" && o.driverId === user?.uid,
  );

  const displayed =
    filter === "available" ? available : filter === "mine" ? mine : done;

  // ── Render order card ──────────────────────────────────────────────────────

  const renderCard = (order: Order) => {
    const cfg = STATUS[order.status];
    const color = order.supermarketColor ?? ORANGE;
    const isAvailable = order.status === "confirmed" && !order.driverId;
    const isMine =
      order.status === "delivering" && order.driverId === user?.uid;

    return (
      <TouchableOpacity
        key={order.id}
        style={[st.card, isAvailable && st.cardHighlight]}
        onPress={() => setSelected(order)}
        activeOpacity={0.85}
      >
        {/* Color bar */}
        <View style={[st.cardBar, { backgroundColor: color }]} />

        <View style={st.cardContent}>
          {/* Top row */}
          <View style={st.cardTop}>
            <View style={[st.statusChip, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={13} color={cfg.color} />
              <Text style={[st.statusChipTxt, { color: cfg.color }]}>
                {cfg.label}
              </Text>
            </View>
            <Text style={st.cardTime}>{fmtTs(order.createdAt)}</Text>
          </View>

          {/* Supermercado */}
          <View style={st.row}>
            <View style={[st.smDot, { backgroundColor: color }]}>
              <Ionicons name="storefront-outline" size={14} color="#fff" />
            </View>
            <Text style={st.cardSmName} numberOfLines={1}>
              {order.supermarketName ?? "Supermercado"}
            </Text>
          </View>

          {/* Destino */}
          <View style={st.row}>
            <Ionicons name="location-outline" size={16} color="#9CA3AF" />
            <Text style={st.cardAddress} numberOfLines={2}>
              {order.userAddress}
            </Text>
          </View>

          {/* Cliente */}
          <View style={st.row}>
            <Ionicons name="person-outline" size={16} color="#9CA3AF" />
            <Text style={st.cardClient}>{order.userName}</Text>
          </View>

          {/* Items summary */}
          <Text style={st.cardItems} numberOfLines={1}>
            {order.items?.map((i) => `${i.qty}× ${i.name}`).join(", ")}
          </Text>

          {/* Footer */}
          <View style={st.cardFooter}>
            <Text style={[st.cardTotal, { color }]}>
              {order.total?.toLocaleString("es-GQ")} XAF
            </Text>
            {isAvailable && (
              <TouchableOpacity
                style={[st.acceptBtn, { backgroundColor: color }]}
                onPress={() => acceptOrder(order)}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={16}
                  color="#fff"
                />
                <Text style={st.acceptBtnTxt}>Aceptar</Text>
              </TouchableOpacity>
            )}
            {isMine && (
              <TouchableOpacity
                style={[st.deliveredBtn, { backgroundColor: "#16A34A" }]}
                onPress={() => markDelivered(order)}
              >
                <Ionicons
                  name="checkmark-done-outline"
                  size={16}
                  color="#fff"
                />
                <Text style={st.acceptBtnTxt}>Entregado</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={st.container} edges={["top"]}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>🏪 Pedidos Supermercados</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={st.tabs}>
        {(
          [
            ["available", `Disponibles (${available.length})`],
            ["mine", `Mis pedidos (${mine.length})`],
            ["done", `Historial (${done.length})`],
          ] as const
        ).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[st.tab, filter === key && st.tabActive]}
            onPress={() => setFilter(key)}
          >
            {key === "available" &&
              available.length > 0 &&
              filter !== "available" && (
                <View style={st.tabBadge}>
                  <Text style={st.tabBadgeTxt}>{available.length}</Text>
                </View>
              )}
            <Text style={[st.tabTxt, filter === key && st.tabTxtActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator
          color={ORANGE}
          size="large"
          style={{ marginTop: 60 }}
        />
      ) : displayed.length === 0 ? (
        <View style={st.empty}>
          <Text style={{ fontSize: 48 }}>
            {filter === "available" ? "🛵" : filter === "mine" ? "📦" : "✅"}
          </Text>
          <Text style={st.emptyTitle}>
            {filter === "available"
              ? "Sin pedidos disponibles"
              : filter === "mine"
                ? "No tienes pedidos activos"
                : "Sin entregas completadas"}
          </Text>
          <Text style={st.emptySub}>
            {filter === "available"
              ? "Cuando un supermercado confirme un pedido aparecerá aquí."
              : filter === "mine"
                ? "Acepta un pedido disponible para empezar."
                : "Tus entregas completadas aparecerán aquí."}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
        >
          {displayed.map(renderCard)}
        </ScrollView>
      )}

      {/* ── DETAIL MODAL ──────────────────────────────────────────────────── */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        {selected &&
          (() => {
            const cfg = STATUS[selected.status];
            const color = selected.supermarketColor ?? ORANGE;
            const isAvailable =
              selected.status === "confirmed" && !selected.driverId;
            const isMine =
              selected.status === "delivering" &&
              selected.driverId === user?.uid;

            return (
              <View style={st.modalOverlay}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => setSelected(null)}
                />
                <View style={st.modal}>
                  {/* Handle */}
                  <View style={st.modalHandle} />

                  {/* Header */}
                  <View style={st.modalHeader}>
                    <View style={[st.statusChip, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                      <Text style={[st.statusChipTxt, { color: cfg.color }]}>
                        {cfg.label}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelected(null)}>
                      <Ionicons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Supermercado */}
                    <View style={[st.modalSection, { borderLeftColor: color }]}>
                      <Text style={st.modalSectionTitle}>
                        🏪 Supermercado (recogida)
                      </Text>
                      <Text style={st.modalSectionValue}>
                        {selected.supermarketName ?? "—"}
                      </Text>
                      {selected.supermarketPhone && (
                        <View style={st.contactRow}>
                          <TouchableOpacity
                            style={[
                              st.contactBtn,
                              { backgroundColor: color + "22" },
                            ]}
                            onPress={() => callPhone(selected.supermarketPhone)}
                          >
                            <Ionicons
                              name="call-outline"
                              size={16}
                              color={color}
                            />
                            <Text style={[st.contactBtnTxt, { color }]}>
                              Llamar
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              st.contactBtn,
                              { backgroundColor: "#D1FAE5" },
                            ]}
                            onPress={() =>
                              openWhatsApp(
                                selected.supermarketPhone,
                                selected.supermarketName ?? "Supermercado",
                              )
                            }
                          >
                            <Ionicons
                              name="logo-whatsapp"
                              size={16}
                              color="#16A34A"
                            />
                            <Text
                              style={[st.contactBtnTxt, { color: "#16A34A" }]}
                            >
                              WhatsApp
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* Cliente */}
                    <View
                      style={[st.modalSection, { borderLeftColor: "#9CA3AF" }]}
                    >
                      <Text style={st.modalSectionTitle}>
                        👤 Cliente (entrega)
                      </Text>
                      <Text style={st.modalSectionValue}>
                        {selected.userName}
                      </Text>
                      <Text style={st.modalSectionSub}>
                        📍 {selected.userAddress}
                      </Text>
                      {selected.notes && (
                        <Text style={st.modalNote}>💬 {selected.notes}</Text>
                      )}
                      {selected.userPhone && (
                        <View style={st.contactRow}>
                          <TouchableOpacity
                            style={[
                              st.contactBtn,
                              { backgroundColor: "#EFF6FF" },
                            ]}
                            onPress={() => callPhone(selected.userPhone)}
                          >
                            <Ionicons
                              name="call-outline"
                              size={16}
                              color="#1E88E5"
                            />
                            <Text
                              style={[st.contactBtnTxt, { color: "#1E88E5" }]}
                            >
                              Llamar
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              st.contactBtn,
                              { backgroundColor: "#D1FAE5" },
                            ]}
                            onPress={() =>
                              openWhatsApp(
                                selected.userPhone,
                                selected.userName,
                              )
                            }
                          >
                            <Ionicons
                              name="logo-whatsapp"
                              size={16}
                              color="#16A34A"
                            />
                            <Text
                              style={[st.contactBtnTxt, { color: "#16A34A" }]}
                            >
                              WhatsApp
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* Productos */}
                    <View style={st.modalProductsWrap}>
                      <Text style={st.modalSectionTitle}>📦 Productos</Text>
                      {selected.items?.map((item, i) => (
                        <View key={i} style={st.modalProductRow}>
                          <View style={st.modalProductQty}>
                            <Text style={[st.modalProductQtyTxt, { color }]}>
                              {item.qty}×
                            </Text>
                          </View>
                          <Text style={st.modalProductName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={[st.modalProductPrice, { color }]}>
                            {(item.price * item.qty).toLocaleString("es-GQ")}{" "}
                            XAF
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Total */}
                    <View style={st.modalTotalRow}>
                      <Text style={st.modalTotalLabel}>Total del pedido</Text>
                      <Text style={[st.modalTotalValue, { color }]}>
                        {selected.total?.toLocaleString("es-GQ")} XAF
                      </Text>
                    </View>
                  </ScrollView>

                  {/* CTA */}
                  {isAvailable && (
                    <TouchableOpacity
                      style={[st.modalCta, { backgroundColor: color }]}
                      onPress={() => acceptOrder(selected)}
                    >
                      <Ionicons name="bicycle-outline" size={22} color="#fff" />
                      <Text style={st.modalCtaTxt}>Aceptar y recoger</Text>
                    </TouchableOpacity>
                  )}
                  {isMine && (
                    <TouchableOpacity
                      style={[st.modalCta, { backgroundColor: "#16A34A" }]}
                      onPress={() => markDelivered(selected)}
                    >
                      <Ionicons
                        name="checkmark-done-outline"
                        size={22}
                        color="#fff"
                      />
                      <Text style={st.modalCtaTxt}>Confirmar entrega</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })()}
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
  },
  // Tabs
  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    position: "relative",
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: ORANGE },
  tabTxt: { fontSize: 12, fontWeight: "600", color: "#9CA3AF" },
  tabTxtActive: { color: ORANGE, fontWeight: "700" },
  tabBadge: {
    position: "absolute",
    top: 6,
    right: 12,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  tabBadgeTxt: { fontSize: 10, fontWeight: "800", color: "#fff" },
  // List
  list: { padding: 16, gap: 12 },
  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHighlight: { shadowOpacity: 0.12, elevation: 4 },
  cardBar: { width: 5 },
  cardContent: { flex: 1, padding: 14, gap: 6 },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusChipTxt: { fontSize: 11, fontWeight: "700" },
  cardTime: { fontSize: 11, color: "#9CA3AF" },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  smDot: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cardSmName: { fontSize: 14, fontWeight: "700", color: "#1F2937", flex: 1 },
  cardAddress: { fontSize: 13, color: "#6B7280", flex: 1, lineHeight: 18 },
  cardClient: { fontSize: 13, color: "#6B7280" },
  cardItems: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  cardTotal: { fontSize: 17, fontWeight: "900" },
  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  deliveredBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  acceptBtnTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },
  // Empty
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937" },
  emptySub: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 22,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 30,
    maxHeight: "85%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalSection: {
    marginHorizontal: 20,
    marginTop: 16,
    borderLeftWidth: 3,
    paddingLeft: 12,
    gap: 4,
  },
  modalSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalSectionValue: { fontSize: 16, fontWeight: "800", color: "#1F2937" },
  modalSectionSub: { fontSize: 13, color: "#6B7280", lineHeight: 20 },
  modalNote: {
    fontSize: 13,
    color: "#92400E",
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  contactRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  contactBtnTxt: { fontSize: 13, fontWeight: "700" },
  modalProductsWrap: { marginHorizontal: 20, marginTop: 16 },
  modalProductRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
  },
  modalProductQty: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalProductQtyTxt: { fontSize: 13, fontWeight: "800" },
  modalProductName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  modalProductPrice: { fontSize: 13, fontWeight: "700" },
  modalTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  modalTotalLabel: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  modalTotalValue: { fontSize: 22, fontWeight: "900" },
  modalCta: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  modalCtaTxt: { fontSize: 16, fontWeight: "800", color: "#fff" },
});
