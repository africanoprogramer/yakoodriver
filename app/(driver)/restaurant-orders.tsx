// app/(driver)/restaurant-orders.tsx
// El driver solo ve pedidos en estado "accepted" (ya aceptados por el restaurante)
// Al aceptar un pedido pasa a "delivering", al entregar pasa a "delivered"

import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import DeliveryTicketModal, { TicketOrder } from "@/components/DeliveryTicketModal";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
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

const GREEN = "#16A34A";

type TabId = "available" | "active" | "history";

interface OrderItem {
  name: string;
  qty: number;
  price: number;
  notes?: string;
}
interface Order {
  id: string;
  restaurantId: string;
  restaurantName: string;
  userId: string;
  userName: string;
  userPhone: string;
  userAddress: string;
  notes: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: string;
  driverUid: string | null;
  createdAt: any;
}

const STATUS_LABEL: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  accepted: { label: "Listo para recoger", color: "#2563EB", bg: "#EFF6FF" },
  delivering: { label: "En camino", color: "#7C3AED", bg: "#F5F3FF" },
  delivered: { label: "Entregado", color: "#16A34A", bg: "#DCFCE7" },
};

const fmtDate = (ts: any) => {
  if (!ts) return "—";
  const d = ts.toDate?.() ?? new Date(ts);
  return d.toLocaleString("es-GQ", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function DriverRestaurantOrders() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>("available");
  const [orders, setOrders] = useState<Order[]>([]);
  const [active, setActive] = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [ticketOrder, setTicketOrder] = useState<TicketOrder | null>(null);
  const [ticketVisible, setTicketVisible] = useState(false);

  // ── Pedidos disponibles (accepted, sin driver) ─────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, "eats_orders"),
        where("status", "==", "accepted"),
        where("driverUid", "==", null),
        orderBy("createdAt", "asc"),
      ),
      (snap) =>
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
    );
    return unsub;
  }, []);

  // ── Mis pedidos activos (delivering) ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(
        collection(db, "eats_orders"),
        where("status", "==", "delivering"),
        where("driverUid", "==", user.uid),
        orderBy("createdAt", "desc"),
      ),
      (snap) =>
        setActive(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
    );
    return unsub;
  }, [user]);

  // ── Historial (delivered por mí) ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(
        collection(db, "eats_orders"),
        where("status", "==", "delivered"),
        where("driverUid", "==", user.uid),
        orderBy("createdAt", "desc"),
      ),
      (snap) =>
        setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
    );
    return unsub;
  }, [user]);

  // ── Aceptar pedido ─────────────────────────────────────────────────────────
  const acceptOrder = async (order: Order) => {
    if (!user) return;
    setLoading(true);
    const batch = writeBatch(db);

    batch.update(doc(db, "eats_orders", order.id), {
      status: "delivering",
      driverUid: user.uid,
      driverName: user.displayName ?? "Driver",
      updatedAt: serverTimestamp(),
    });

    // Notificación al usuario
    batch.set(doc(collection(db, "user_notifications")), {
      userId: order.userId,
      type: "order_delivering",
      title: "Tu pedido está en camino 🛵",
      body: "Un conductor ha recogido tu pedido y está yendo hacia ti.",
      orderId: order.id,
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    setLoading(false);
    setSelected(null);
    setTab("active");
  };

  // ── Confirmar entrega ──────────────────────────────────────────────────────
  const confirmDelivery = async (order: Order) => {
    Alert.alert(
      "¿Confirmar entrega?",
      `¿Has entregado el pedido a ${order.userName}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, entregado",
          onPress: async () => {
            setLoading(true);
            const batch = writeBatch(db);

            batch.update(doc(db, "eats_orders", order.id), {
              status: "delivered",
              deliveredAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            // Notificación al usuario
            batch.set(doc(collection(db, "user_notifications")), {
              userId: order.userId,
              type: "order_delivered",
              title: "¡Pedido entregado! ✅",
              body: "Tu pedido ha llegado. ¡Buen provecho!",
              orderId: order.id,
              read: false,
              createdAt: serverTimestamp(),
            });

            await batch.commit();
            setLoading(false);
            setSelected(null);

            // Mostrar ticket
            setTicketOrder({
              id: order.id,
              module: "eats",
              restaurantName: order.restaurantName,
              userName: order.userName,
              userPhone: order.userPhone,
              address: order.userAddress,
              items: order.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
              subtotal: order.subtotal,
              deliveryFee: order.deliveryFee,
              total: order.total,
              paymentMethod: "cash",
              driverName: user?.displayName ?? "Driver",
              deliveredAt: new Date(),
              createdAt: order.createdAt,
            });
            setTicketVisible(true);
          },
        },
      ],
    );
  };

  const shown =
    tab === "available" ? orders : tab === "active" ? active : history;
  const tabLabel = {
    available: "Disponibles",
    active: "Mis pedidos",
    history: "Historial",
  };

  return (
    <SafeAreaView style={st.container} edges={["top"]}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#1F2937" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>🍽️ Pedidos Restaurantes</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={st.tabs}>
        {(["available", "active", "history"] as TabId[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[st.tab, tab === t && st.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[st.tabTxt, tab === t && st.tabTxtActive]}>
              {tabLabel[t]}
            </Text>
            {t === "available" && orders.length > 0 && (
              <View style={st.tabBadge}>
                <Text style={st.tabBadgeTxt}>{orders.length}</Text>
              </View>
            )}
            {t === "active" && active.length > 0 && (
              <View style={[st.tabBadge, { backgroundColor: GREEN }]}>
                <Text style={st.tabBadgeTxt}>{active.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.list}
      >
        {shown.length === 0 ? (
          <View style={st.empty}>
            <Text style={{ fontSize: 44 }}>🍽️</Text>
            <Text style={st.emptyTxt}>
              {tab === "available"
                ? "No hay pedidos disponibles ahora"
                : tab === "active"
                  ? "No tienes pedidos activos"
                  : "Sin historial todavía"}
            </Text>
          </View>
        ) : (
          shown.map((order) => {
            const cfg = STATUS_LABEL[order.status] ?? STATUS_LABEL["accepted"];
            return (
              <TouchableOpacity
                key={order.id}
                style={st.card}
                onPress={() => setSelected(order)}
              >
                <View style={st.cardTop}>
                  <View>
                    <Text style={st.cardRestaurant}>
                      {order.restaurantName}
                    </Text>
                    <Text style={st.cardDate}>{fmtDate(order.createdAt)}</Text>
                  </View>
                  <View style={[st.statusChip, { backgroundColor: cfg.bg }]}>
                    <Text style={[st.statusTxt, { color: cfg.color }]}>
                      {cfg.label}
                    </Text>
                  </View>
                </View>

                <View style={st.cardRow}>
                  <Ionicons name="person-outline" size={14} color="#9CA3AF" />
                  <Text style={st.cardRowTxt}>
                    {order.userName} · {order.userPhone}
                  </Text>
                </View>
                <View style={st.cardRow}>
                  <Ionicons name="location-outline" size={14} color="#9CA3AF" />
                  <Text style={st.cardRowTxt} numberOfLines={1}>
                    {order.userAddress}
                  </Text>
                </View>

                <View style={st.cardBottom}>
                  <Text style={st.cardItems} numberOfLines={1}>
                    {order.items?.map((i) => `${i.qty}x ${i.name}`).join(", ")}
                  </Text>
                  <Text style={st.cardFee}>
                    Entrega: {order.deliveryFee?.toLocaleString("es-GQ")} XAF
                  </Text>
                </View>

                {/* Inline accept for available */}
                {tab === "available" && (
                  <TouchableOpacity
                    style={st.acceptBtn}
                    onPress={() => acceptOrder(order)}
                    disabled={loading}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#fff"
                    />
                    <Text style={st.acceptBtnTxt}>Aceptar pedido</Text>
                  </TouchableOpacity>
                )}

                {tab === "active" && (
                  <TouchableOpacity
                    style={[st.acceptBtn, { backgroundColor: "#7C3AED" }]}
                    onPress={() => confirmDelivery(order)}
                    disabled={loading}
                  >
                    <Ionicons
                      name="checkmark-done-outline"
                      size={18}
                      color="#fff"
                    />
                    <Text style={st.acceptBtnTxt}>Confirmar entrega</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Delivery ticket */}
      <DeliveryTicketModal
        visible={ticketVisible}
        order={ticketOrder}
        onClose={() => { setTicketVisible(false); setTicketOrder(null); }}
      />

      {/* ── DETAIL MODAL ─────────────────────────────────────────────────────── */}
      {selected &&
        (() => {
          const cfg = STATUS_LABEL[selected.status] ?? STATUS_LABEL["accepted"];
          return (
            <Modal visible transparent animationType="slide">
              <View style={st.overlay}>
                <View style={st.modal}>
                  <View style={st.handle} />
                  <ScrollView>
                    <View style={st.modalHeader}>
                      <View>
                        <Text style={st.modalTitle}>
                          {selected.restaurantName}
                        </Text>
                        <Text style={st.modalDate}>
                          {fmtDate(selected.createdAt)}
                        </Text>
                      </View>
                      <View
                        style={[st.statusChip, { backgroundColor: cfg.bg }]}
                      >
                        <Text style={[st.statusTxt, { color: cfg.color }]}>
                          {cfg.label}
                        </Text>
                      </View>
                    </View>

                    {/* Cliente */}
                    <View style={st.section}>
                      <Text style={st.sectionTitle}>👤 Cliente</Text>
                      <View style={st.infoRow}>
                        <Ionicons
                          name="person-outline"
                          size={15}
                          color="#9CA3AF"
                        />
                        <Text style={st.infoTxt}>{selected.userName}</Text>
                      </View>
                      <View style={st.infoRow}>
                        <Ionicons
                          name="call-outline"
                          size={15}
                          color="#9CA3AF"
                        />
                        <Text style={st.infoTxt}>{selected.userPhone}</Text>
                        <TouchableOpacity
                          onPress={() =>
                            Linking.openURL(`tel:${selected.userPhone}`)
                          }
                        >
                          <Text style={st.callTxt}>Llamar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            Linking.openURL(
                              `https://wa.me/${selected.userPhone.replace(/\D/g, "")}`,
                            )
                          }
                        >
                          <Text style={[st.callTxt, { color: "#25D366" }]}>
                            WhatsApp
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={st.infoRow}>
                        <Ionicons
                          name="location-outline"
                          size={15}
                          color="#9CA3AF"
                        />
                        <Text style={st.infoTxt}>{selected.userAddress}</Text>
                      </View>
                      {selected.notes ? (
                        <View style={st.infoRow}>
                          <Ionicons
                            name="chatbubble-outline"
                            size={15}
                            color="#9CA3AF"
                          />
                          <Text style={st.infoTxt}>{selected.notes}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Pedido */}
                    <View style={st.section}>
                      <Text style={st.sectionTitle}>🍽️ Items</Text>
                      {selected.items?.map((item, i) => (
                        <View key={i} style={st.itemRow}>
                          <Text style={st.itemQty}>{item.qty}x</Text>
                          <Text style={st.itemName}>{item.name}</Text>
                          {item.notes ? (
                            <Text style={st.itemNotes}>📝 {item.notes}</Text>
                          ) : null}
                        </View>
                      ))}
                    </View>

                    {/* Tarifa de entrega */}
                    <View
                      style={[
                        st.section,
                        {
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        },
                      ]}
                    >
                      <View>
                        <Text style={st.sectionTitle}>💵 Tu ganancia</Text>
                        <Text style={st.feeNote}>
                          Tarifa de entrega de este pedido
                        </Text>
                      </View>
                      <Text style={st.feeAmount}>
                        {selected.deliveryFee?.toLocaleString("es-GQ")} XAF
                      </Text>
                    </View>

                    {/* Actions */}
                    <View style={st.modalActions}>
                      {selected.status === "accepted" && (
                        <TouchableOpacity
                          style={[st.actionBtn, { backgroundColor: GREEN }]}
                          onPress={() => acceptOrder(selected)}
                          disabled={loading}
                        >
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={18}
                            color="#fff"
                          />
                          <Text style={st.actionBtnTxt}>Aceptar y recoger</Text>
                        </TouchableOpacity>
                      )}
                      {selected.status === "delivering" && (
                        <TouchableOpacity
                          style={[st.actionBtn, { backgroundColor: "#7C3AED" }]}
                          onPress={() => confirmDelivery(selected)}
                          disabled={loading}
                        >
                          <Ionicons
                            name="checkmark-done-outline"
                            size={18}
                            color="#fff"
                          />
                          <Text style={st.actionBtnTxt}>Confirmar entrega</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      style={st.closeBtn}
                      onPress={() => setSelected(null)}
                    >
                      <Text style={st.closeBtnTxt}>Cerrar</Text>
                    </TouchableOpacity>
                    <View style={{ height: 30 }} />
                  </ScrollView>
                </View>
              </View>
            </Modal>
          );
        })()}
    </SafeAreaView>
  );
}

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
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
  },
  tabActive: { backgroundColor: GREEN },
  tabTxt: { fontSize: 13, fontWeight: "700", color: "#6B7280" },
  tabTxtActive: { color: "#fff" },
  tabBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  tabBadgeTxt: { fontSize: 10, fontWeight: "800", color: "#fff" },
  list: { padding: 16, gap: 12 },
  empty: { alignItems: "center", paddingVertical: 50, gap: 10 },
  emptyTxt: {
    fontSize: 15,
    fontWeight: "600",
    color: "#9CA3AF",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardRestaurant: { fontSize: 15, fontWeight: "800", color: "#1F2937" },
  cardDate: { fontSize: 12, color: "#9CA3AF" },
  statusChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusTxt: { fontSize: 12, fontWeight: "700" },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardRowTxt: { fontSize: 12, color: "#6B7280", flex: 1 },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 8,
  },
  cardItems: { fontSize: 12, color: "#9CA3AF", flex: 1, marginRight: 8 },
  cardFee: { fontSize: 13, fontWeight: "700", color: GREEN },
  acceptBtn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  acceptBtnTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },
  // Modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#1F2937" },
  modalDate: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  section: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 14,
    marginTop: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoTxt: { fontSize: 14, color: "#374151", flex: 1 },
  callTxt: { fontSize: 13, fontWeight: "700", color: "#2563EB" },
  itemRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  itemQty: { fontSize: 14, fontWeight: "800", color: "#6B7280", width: 24 },
  itemName: { fontSize: 14, color: "#1F2937", flex: 1, fontWeight: "600" },
  itemNotes: { fontSize: 11, color: "#9CA3AF" },
  feeNote: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  feeAmount: { fontSize: 24, fontWeight: "900", color: GREEN },
  modalActions: { marginTop: 16, gap: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
  },
  actionBtnTxt: { fontSize: 15, fontWeight: "800", color: "#fff" },
  closeBtn: { marginTop: 10, alignItems: "center", paddingVertical: 14 },
  closeBtnTxt: { fontSize: 14, color: "#9CA3AF", fontWeight: "600" },
});
