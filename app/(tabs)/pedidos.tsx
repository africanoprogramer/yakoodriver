/**
 * app/(tabs)/pedidos.tsx — YakooDriver
 *
 * Tab de Pedidos unificado para todos los módulos.
 * Flujos:
 *  - Abacería/Farmacia/Librería: pending → accepted → picking_up → on_the_way → delivered
 *  - Eats: pending → accepted → preparing → on_the_way → delivered
 *  - Shop: ready → delivering → delivered (el conductor acepta cuando está "listo")
 *  - Gas: pending → accepted → picking_up → on_the_way → delivered
 */

import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { PUSH_MESSAGES, sendPushNotification } from "@/utils/pushNotifications";
import DeliveryTicketModal, { TicketOrder } from "@/components/DeliveryTicketModal";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

// ── Types ────────────────────────────────────────────────────────
type OrderStatus =
  | "pending"
  | "accepted"
  | "confirmed"
  | "picking_up"
  | "preparing"
  | "ready"
  | "delivering"
  | "on_the_way"
  | "delivered"
  | "cancelled";

interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  unit: string;
}
type OrderModule =
  | "abaceria"
  | "farmacia"
  | "eats"
  | "libreria"
  | "shop"
  | "gas";

interface AbaceriaOrder {
  id: string;
  orderId?: string;
  userId: string;
  userName: string;
  userPhone: string;
  deliveryAddress: string | { text: string; reference?: string };
  address?: string;
  phone?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  estimatedMinutes?: number;
  paymentMethod: "yakoo_pay" | "cash";
  paymentStatus?: string;
  status: OrderStatus;
  driverId?: string | null;
  driverName?: string | null;
  userPushToken?: string | null;
  notes?: string;
  needsPrescription?: boolean;
  prescriptionUrl?: string;
  module: OrderModule;
  createdAt: any;
  acceptedAt?: any;
  pickedUpAt?: any;
  deliveredAt?: any;
}

// ── Helpers ──────────────────────────────────────────────────────

const getAddressText = (order: AbaceriaOrder): string => {
  if (order.address) return order.address;
  const addr = order.deliveryAddress;
  if (!addr) return "Sin dirección";
  if (typeof addr === "string") return addr;
  return [(addr as any).text || (addr as any).address, (addr as any).reference]
    .filter(Boolean)
    .join(" · ");
};

const getUserPhone = (order: AbaceriaOrder): string =>
  (order as any).buyerPhone || order.userPhone || order.phone || "—";

const getUserName = (order: AbaceriaOrder): string =>
  (order as any).buyerName || order.userName || "Cliente";

const getCollection = (module: OrderModule) => {
  if (module === "farmacia") return "farmacia_orders";
  if (module === "eats") return "eats_orders";
  if (module === "libreria") return "libreria_orders";
  if (module === "shop") return "shop_orders";
  if (module === "gas") return "gas_orders";
  return "abaceria_orders";
};

// ── Status config ────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: string }
> = {
  pending: {
    label: "Pendiente",
    color: "#F59E0B",
    bg: "#2D2010",
    icon: "time",
  },
  accepted: {
    label: "Aceptado",
    color: "#3B82F6",
    bg: "#1E2A4A",
    icon: "checkmark-circle",
  },
  confirmed: {
    label: "Confirmado",
    color: "#3B82F6",
    bg: "#1E2A4A",
    icon: "checkmark-circle",
  },
  picking_up: {
    label: "Recogiendo",
    color: "#8B5CF6",
    bg: "#2D1B4A",
    icon: "storefront",
  },
  preparing: {
    label: "Preparando",
    color: "#8B5CF6",
    bg: "#2D1B4A",
    icon: "restaurant",
  },
  ready: {
    label: "Listo para recoger",
    color: "#10B981",
    bg: "#064E3B",
    icon: "cube",
  },
  delivering: {
    label: "En reparto",
    color: "#F2AB30",
    bg: "#2D2010",
    icon: "bicycle",
  },
  on_the_way: {
    label: "En camino",
    color: "#F2AB30",
    bg: "#2D2010",
    icon: "bicycle",
  },
  delivered: {
    label: "Entregado",
    color: "#10B981",
    bg: "#064E3B",
    icon: "checkmark-done",
  },
  cancelled: {
    label: "Cancelado",
    color: "#EF4444",
    bg: "#2D1010",
    icon: "close-circle",
  },
};

// ── Flujos por módulo ────────────────────────────────────────────

const NEXT_STATUS_DELIVERY: Record<
  string,
  { status: string; label: string; icon: string }
> = {
  accepted: { status: "picking_up", label: "Ir a recoger", icon: "storefront" },
  picking_up: {
    status: "on_the_way",
    label: "Pedido recogido",
    icon: "bicycle",
  },
  on_the_way: {
    status: "delivered",
    label: "Confirmar entrega",
    icon: "checkmark-done",
  },
};

const NEXT_STATUS_EATS: Record<
  string,
  { status: string; label: string; icon: string }
> = {
  accepted: {
    status: "preparing",
    label: "Restaurante listo",
    icon: "restaurant",
  },
  preparing: {
    status: "on_the_way",
    label: "Recogido, en camino",
    icon: "bicycle",
  },
  on_the_way: {
    status: "delivered",
    label: "Confirmar entrega",
    icon: "checkmark-done",
  },
};

const NEXT_STATUS_SHOP: Record<
  string,
  { status: string; label: string; icon: string }
> = {
  delivering: {
    status: "delivered",
    label: "Confirmar entrega",
    icon: "checkmark-done",
  },
};

const getNextStatus = (module: OrderModule, status: string) =>
  module === "eats"
    ? NEXT_STATUS_EATS[status]
    : module === "shop"
      ? NEXT_STATUS_SHOP[status]
      : NEXT_STATUS_DELIVERY[status];

// ── Filters ──────────────────────────────────────────────────────
const FILTERS: { key: string; label: string }[] = [
  { key: "active", label: "Activos" },
  { key: "pending", label: "Pendientes" },
  { key: "delivered", label: "Historial" },
];

const ACTIVE_FILTER_STATUSES = [
  "accepted",
  "confirmed",
  "picking_up",
  "on_the_way",
  "preparing",
  "ready",
  "delivering",
];

const PENDING_FILTER_STATUSES = ["pending", "ready"];

const fmt = (n: number) => n.toLocaleString("es-GQ") + " XAF";

// ── Order Card ───────────────────────────────────────────────────
const OrderCard = ({
  order,
  onPress,
  onAccept,
  onAdvance,
}: {
  order: AbaceriaOrder;
  onPress: () => void;
  onAccept?: () => void;
  onAdvance?: () => void;
}) => {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const next = getNextStatus(order.module, order.status);
  const pulse = useRef(new Animated.Value(1)).current;
  const canAccept =
    (order.status === "pending" && order.module !== "eats") ||
    order.status === "ready" ||
    (order.status === "accepted" && !order.driverId);
  useEffect(() => {
    if (canAccept) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [order.status]);

  return (
    <TouchableOpacity
      style={[st.card, { borderLeftColor: cfg.color }]}
      onPress={onPress}
      activeOpacity={0.92}
    >
      {/* Status badge */}
      <View style={st.cardTop}>
        <View style={[st.statusBadge, { backgroundColor: cfg.bg }]}>
          {canAccept && (
            <Animated.View style={{ opacity: pulse, marginRight: 4 }}>
              <View style={[st.dot, { backgroundColor: cfg.color }]} />
            </Animated.View>
          )}
          <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
          <Text style={[st.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={st.orderId}>
          #{order.orderId?.slice(-6) ?? order.id.slice(-6)}
        </Text>
        {order.module === "eats" && (order as any).restaurantName && (
          <Text style={{ fontSize: 11, color: "#F97316", fontWeight: "600" }}>
            🍽️ {(order as any).restaurantName}
          </Text>
        )}
        {order.module === "shop" && (order as any).sellerName && (
          <Text style={{ fontSize: 11, color: "#F97316", fontWeight: "600" }}>
            🛍️ {(order as any).sellerName}
          </Text>
        )}
        <Text style={st.orderTime}>
          {order.createdAt?.toDate
            ? order.createdAt.toDate().toLocaleTimeString("es-GQ", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </Text>
      </View>

      {/* Client */}
      <View style={st.clientRow}>
        <View style={st.clientAvatar}>
          <Text style={st.clientAvatarTxt}>
            {getUserName(order)[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.clientName}>{getUserName(order)}</Text>
          <Text style={st.clientPhone}>{getUserPhone(order)}</Text>
        </View>
        <View style={st.totalWrap}>
          <Text style={st.totalAmt}>{fmt(order.total)}</Text>
          <Text style={st.payMethod}>
            {order.paymentMethod === "cash" ? "💵 Efectivo" : "📱 Yakoo Pay"}
          </Text>
        </View>
      </View>

      {/* Address */}
      <View style={st.addrRow}>
        <Ionicons name="location" size={14} color="#F2AB30" />
        <Text style={st.addrTxt} numberOfLines={2}>
          {getAddressText(order)}
        </Text>
      </View>

      {/* Items count */}
      <View style={st.itemsRow}>
        <Ionicons name="bag" size={13} color="#6B7280" />
        <Text style={st.itemsTxt}>
          {order.items?.length ?? 0} productos · {fmt(order.deliveryFee)} envío
        </Text>
      </View>

      {/* Accept button */}
      {canAccept && onAccept && (
        <View style={st.actionRow}>
          <TouchableOpacity
            style={st.rejectBtn}
            onPress={() =>
              Alert.alert("¿Rechazar?", "No recibirás este pedido.", [
                { text: "Cancelar" },
                { text: "Rechazar", style: "destructive", onPress: () => {} },
              ])
            }
          >
            <Text style={st.rejectBtnTxt}>Rechazar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.acceptBtn} onPress={onAccept}>
            <Ionicons name="checkmark" size={16} color="#1F2937" />
            <Text style={st.acceptBtnTxt}>Aceptar pedido</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Advance button */}
      {next && onAdvance && order.driverId && (
        <TouchableOpacity style={st.advanceBtn} onPress={onAdvance}>
          <Ionicons name={next.icon as any} size={16} color="#1F2937" />
          <Text style={st.advanceBtnTxt}>{next.label}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

// ── Order Detail Modal ───────────────────────────────────────────
const OrderDetail = ({
  order,
  visible,
  onClose,
  onAdvance,
}: {
  order: AbaceriaOrder | null;
  visible: boolean;
  onClose: () => void;
  onAdvance: (order: AbaceriaOrder) => void;
}) => {
  if (!order) return null;
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const next = getNextStatus(order.module, order.status);
  const clientName = getUserName(order);
  const clientPhone = getUserPhone(order);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={st.modal}>
        <View style={st.modalHandle} />

        {/* Header */}
        <View style={st.modalHeader}>
          <View>
            <Text style={st.modalTitle}>
              Pedido #{order.orderId?.slice(-6) ?? order.id.slice(-6)}
            </Text>
            <View
              style={[
                st.statusBadge,
                { backgroundColor: cfg.bg, marginTop: 4 },
              ]}
            >
              <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
              <Text style={[st.statusTxt, { color: cfg.color }]}>
                {cfg.label}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={st.modalClose} onPress={onClose}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Client info */}
          <View style={st.modalSection}>
            <Text style={st.modalSectionTitle}>Cliente</Text>
            <View style={st.infoRow}>
              <Ionicons name="person" size={16} color="#9CA3AF" />
              <Text style={st.infoTxt}>{clientName}</Text>
            </View>
            <View style={st.infoRow}>
              <Ionicons name="call" size={16} color="#9CA3AF" />
              <Text style={st.infoTxt}>{clientPhone}</Text>
              <TouchableOpacity
                style={st.callBtn}
                onPress={() => Linking.openURL(`tel:${clientPhone}`)}
              >
                <Text style={st.callBtnTxt}>Llamar</Text>
              </TouchableOpacity>
            </View>
            <View style={st.infoRow}>
              <Ionicons name="location" size={16} color="#F2AB30" />
              <Text style={st.infoTxt}>{getAddressText(order)}</Text>
            </View>
            {order.notes ? (
              <View style={st.noteBox}>
                <Ionicons name="chatbubble" size={14} color="#F2AB30" />
                <Text style={st.noteTxt}>{order.notes}</Text>
              </View>
            ) : null}
          </View>

          {/* Seller info for Shop */}
          {order.module === "shop" && (order as any).sellerName && (
            <View style={st.modalSection}>
              <Text style={st.modalSectionTitle}>Vendedor</Text>
              <View style={st.infoRow}>
                <Ionicons name="storefront" size={16} color="#F97316" />
                <Text style={st.infoTxt}>{(order as any).sellerName}</Text>
              </View>
            </View>
          )}

          {/* Products */}
          <View style={st.modalSection}>
            <Text style={st.modalSectionTitle}>
              Productos ({order.items?.length ?? 0})
            </Text>
            {order.items?.map((item, i) => (
              <View key={i} style={st.itemRow}>
                <View style={st.itemQty}>
                  <Text style={st.itemQtyTxt}>{item.qty}x</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.itemName}>{item.name}</Text>
                  {(item as any).requiresPrescription && (
                    <Text
                      style={{
                        fontSize: 10,
                        color: "#A78BFA",
                        fontWeight: "600",
                      }}
                    >
                      💜 Requiere Rx
                    </Text>
                  )}
                </View>
                <Text style={st.itemPrice}>{fmt(item.price * item.qty)}</Text>
              </View>
            ))}
          </View>

          {/* Rx notice for farmacia */}
          {order.needsPrescription && (
            <View
              style={[
                st.modalSection,
                { backgroundColor: "#2D1B4A", borderColor: "#7C3AED" },
              ]}
            >
              <Text style={[st.modalSectionTitle, { color: "#A78BFA" }]}>
                💜 Receta médica
              </Text>
              {order.prescriptionUrl ? (
                <Text
                  style={{ color: "#10B981", fontSize: 13, fontWeight: "600" }}
                >
                  ✅ Receta subida por el usuario
                </Text>
              ) : (
                <Text
                  style={{ color: "#EF4444", fontSize: 13, fontWeight: "600" }}
                >
                  ⚠️ El usuario aún no ha subido la receta
                </Text>
              )}
            </View>
          )}

          {/* Payment */}
          <View style={st.modalSection}>
            <Text style={st.modalSectionTitle}>Resumen de pago</Text>
            <View style={st.payRow}>
              <Text style={st.payLabel}>Subtotal</Text>
              <Text style={st.payValue}>{fmt(order.subtotal)}</Text>
            </View>
            <View style={st.payRow}>
              <Text style={st.payLabel}>Envío</Text>
              <Text style={st.payValue}>{fmt(order.deliveryFee)}</Text>
            </View>
            <View style={[st.payRow, st.payTotal]}>
              <Text style={st.payTotalLabel}>TOTAL</Text>
              <Text style={st.payTotalValue}>{fmt(order.total)}</Text>
            </View>
            <View style={st.payMethodBox}>
              <Text style={st.payMethodTxt}>
                {order.paymentMethod === "cash"
                  ? "💵 Pago en efectivo al entregar"
                  : "📱 Pagado con Yakoo Pay"}
              </Text>
            </View>
          </View>

          {/* Earnings */}
          {(order.status === "delivered" || order.driverId) && (
            <View
              style={[
                st.modalSection,
                { backgroundColor: "#064E3B", borderColor: "#10B981" },
              ]}
            >
              <Text style={[st.modalSectionTitle, { color: "#10B981" }]}>
                Tus ganancias
              </Text>
              <Text style={st.earningAmt}>{fmt(order.deliveryFee)}</Text>
              <Text style={st.earningDesc}>Por esta entrega</Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom action */}
        {next && order.driverId && (
          <View style={st.modalFooter}>
            <TouchableOpacity
              style={st.advanceBtn}
              onPress={() => {
                onAdvance(order);
                onClose();
              }}
            >
              <Ionicons name={next.icon as any} size={18} color="#1F2937" />
              <Text style={st.advanceBtnTxt}>{next.label}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

// ── MAIN SCREEN ──────────────────────────────────────────────────
export default function PedidosScreen() {
  const { driverData, user } = useAuth();

  const [orders, setOrders] = useState<AbaceriaOrder[]>([]);
  const [filter, setFilter] = useState<string>("active");
  const [selected, setSelected] = useState<AbaceriaOrder | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState<OrderModule>("abaceria");
  const [ticketOrder, setTicketOrder] = useState<TicketOrder | null>(null);
  const [ticketVisible, setTicketVisible] = useState(false);

  // ── Real-time subscription ──
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    if (!driverData?.isOnline) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const collectionName = getCollection(module);
    const activeStatuses =
      module === "eats"
        ? ["accepted", "preparing", "on_the_way", "delivered"]
        : module === "shop"
          ? [
              // "pending",
              // "confirmed",
              // "preparing",
              "ready",
              "delivering",
              "delivered",
            ]
          : module === "gas"
            ? ["pending", "accepted", "picking_up", "on_the_way", "delivered"]
            : ["pending", "accepted", "picking_up", "on_the_way", "delivered"];

    const q = query(
      collection(db, collectionName),
      where("status", "in", activeStatuses),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map(
          (d) => ({ id: d.id, ...d.data(), module }) as AbaceriaOrder,
        );
        all.sort((a, b) => {
          const ta = a.createdAt?.toDate?.()?.getTime() ?? 0;
          const tb = b.createdAt?.toDate?.()?.getTime() ?? 0;
          return tb - ta;
        });
        setOrders(all);
        setLoading(false);
      },
      (err) => {
        console.error("❌ Error escuchando pedidos:", err);
        setLoading(false);
      },
    );

    return unsub;
  }, [user?.uid, driverData?.isOnline, module]);

  // ── Filter ──
  const filtered = orders.filter((o) => {
    if (filter === "active") return ACTIVE_FILTER_STATUSES.includes(o.status);
    if (filter === "pending") return PENDING_FILTER_STATUSES.includes(o.status);
    if (filter === "delivered") return o.status === "delivered";
    return o.status === filter;
  });

  const activeCount = orders.filter((o) =>
    ACTIVE_FILTER_STATUSES.includes(o.status),
  ).length;
  const pendingCount = orders.filter((o) =>
    PENDING_FILTER_STATUSES.includes(o.status),
  ).length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;

  // ── Accept order ──
  const handleAccept = async (order: AbaceriaOrder) => {
    if (!user?.uid || !driverData) return;
    try {
      const newStatus =
        order.module === "shop" && order.status === "ready"
          ? "delivering"
          : order.module === "eats" && order.status === "accepted"
            ? "accepted"
            : "accepted";

      await updateDoc(doc(db, getCollection(order.module), order.id), {
        status: newStatus,
        driverId: user.uid,
        driverName: driverData.fullName,
        driverPhone: driverData.phone ?? null,
        acceptedAt: serverTimestamp(),
      });

      // Notificar al comprador
      const pushToken = order.userPushToken || (order as any).buyerPushToken;
      if (pushToken) {
        const msg = PUSH_MESSAGES.orderAccepted(driverData.fullName);
        await sendPushNotification({
          token: pushToken,
          ...msg,
          data: { orderId: order.id },
        });
      }
    } catch {
      Alert.alert("Error", "No se pudo aceptar el pedido. Inténtalo de nuevo.");
    }
  };

  // ── Advance status ──
  const handleAdvance = async (order: AbaceriaOrder) => {
    const next = getNextStatus(order.module, order.status);
    if (!next) return;

    const tsField: Record<string, string> = {
      picking_up: "pickedUpAt",
      on_the_way: "onTheWayAt",
      delivering: "deliveringAt",
      delivered: "deliveredAt",
    };

    try {
      await updateDoc(doc(db, getCollection(order.module), order.id), {
        status: next.status,
        [tsField[next.status] ?? "updatedAt"]: serverTimestamp(),
      });

      // Notificar al usuario
      const pushToken = order.userPushToken || (order as any).buyerPushToken;
      if (pushToken) {
        const msgMap: Partial<Record<string, { title: string; body: string }>> =
          {
            picking_up: PUSH_MESSAGES.orderPickingUp(
              driverData?.fullName ?? "Tu repartidor",
            ),
            on_the_way: PUSH_MESSAGES.orderOnTheWay(
              driverData?.fullName ?? "Tu repartidor",
            ),
            delivering: {
              title: "🛵 Tu pedido está en camino",
              body: `${driverData?.fullName ?? "El repartidor"} va de camino con tu pedido.`,
            },
            delivered: PUSH_MESSAGES.orderDelivered(),
          };
        const msg = msgMap[next.status];
        if (msg) {
          await sendPushNotification({
            token: pushToken,
            ...msg,
            data: { orderId: order.id },
          });
        }
      }

      // Al entregar: acreditar ganancias al conductor
      if (next.status === "delivered" && user?.uid && order.deliveryFee > 0) {
        await updateDoc(doc(db, "drivers", user.uid), {
          balance: increment(order.deliveryFee),
          totalEarnings: increment(order.deliveryFee),
          totalTrips: increment(1),
        });
        // Mostrar ticket de entrega
        setTicketOrder({
          ...order,
          driverName: driverData?.fullName ?? user.displayName ?? "Driver",
          deliveredAt: new Date(),
        } as any);
        setTicketVisible(true);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "No se pudo actualizar el estado.");
    }
  };

  const isOffline = !driverData?.isOnline;

  return (
    <SafeAreaView style={st.container} edges={["top"]}>
      {/* Header */}
      <View style={st.header}>
        <View>
          <Text style={st.headerTitle}>
            {module === "abaceria"
              ? "🛒 Abacería"
              : module === "farmacia"
                ? "💊 Farmacia"
                : module === "eats"
                  ? "🍽️ YakooEats"
                  : module === "shop"
                    ? "🛍️ Yakoo Shop"
                    : module === "gas"
                      ? "🔥 Yakoo Gas"
                      : "📚 Librería"}
          </Text>
          <Text style={st.headerSub}>{pendingCount} pendientes ahora</Text>
        </View>
        <View style={st.onlineChip}>
          <View style={st.onlineDot} />
          <Text style={st.onlineChipTxt}>En línea</Text>
        </View>
      </View>

      {/* Module selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.moduleSelector}
      >
        {[
          {
            id: "abaceria" as OrderModule,
            label: "🛒 Abacería",
            active: st.moduleBtnActive,
            activeTxt: st.moduleBtnTxtActive,
          },
          {
            id: "shop" as OrderModule,
            label: "🛍️ Shop",
            active: { backgroundColor: "#2D1A0E", borderColor: "#F97316" },
            activeTxt: { color: "#F97316" },
          },
          {
            id: "eats" as OrderModule,
            label: "🍽️ Eats",
            active: st.moduleBtnActiveEats,
            activeTxt: st.moduleBtnTxtActiveEats,
          },
          {
            id: "gas" as OrderModule,
            label: "🔥 Gas",
            active: { backgroundColor: "#2D1010", borderColor: "#EF4444" },
            activeTxt: { color: "#EF4444" },
          },
          {
            id: "farmacia" as OrderModule,
            label: "💊 Farmacia",
            active: st.moduleBtnActiveFarma,
            activeTxt: st.moduleBtnTxtActiveFarma,
          },
          {
            id: "libreria" as OrderModule,
            label: "📚 Librería",
            active: st.moduleBtnActiveLib,
            activeTxt: st.moduleBtnTxtActiveLib,
          },
        ].map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[st.moduleBtn, module === m.id && m.active]}
            onPress={() => {
              setModule(m.id);
              setFilter("active");
            }}
          >
            <Text style={[st.moduleBtnTxt, module === m.id && m.activeTxt]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Offline banner */}
      {isOffline && (
        <View style={st.offlineBanner}>
          <Text style={st.offlineBannerEmoji}>🔴</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.offlineBannerTitle}>Estás desconectado</Text>
            <Text style={st.offlineBannerSub}>
              Ve al tab Inicio y activa &quot;Online&quot; para recibir pedidos
            </Text>
          </View>
        </View>
      )}

      {/* Earnings today */}
      <View style={st.earningsBar}>
        <View style={st.earningsItem}>
          <Text style={st.earningsVal}>
            {fmt(
              orders
                .filter(
                  (o) => o.status === "delivered" && o.driverId === user?.uid,
                )
                .reduce((sum, o) => sum + o.deliveryFee, 0),
            )}
          </Text>
          <Text style={st.earningsLabel}>Ganado hoy</Text>
        </View>
        <View style={st.earningsDivider} />
        <View style={st.earningsItem}>
          <Text style={st.earningsVal}>
            {
              orders.filter(
                (o) => o.status === "delivered" && o.driverId === user?.uid,
              ).length
            }
          </Text>
          <Text style={st.earningsLabel}>Entregas hoy</Text>
        </View>
        <View style={st.earningsDivider} />
        <View style={st.earningsItem}>
          <Text style={st.earningsVal}>
            {
              orders.filter(
                (o) =>
                  ACTIVE_FILTER_STATUSES.includes(o.status) &&
                  o.driverId === user?.uid,
              ).length
            }
          </Text>
          <Text style={st.earningsLabel}>En curso</Text>
        </View>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={st.filters}
        contentContainerStyle={{
          paddingHorizontal: 16,
          gap: 8,
          paddingVertical: 4,
        }}
      >
        {FILTERS.map((f) => {
          const count =
            f.key === "active"
              ? activeCount
              : f.key === "pending"
                ? pendingCount
                : f.key === "delivered"
                  ? deliveredCount
                  : 0;
          return (
            <TouchableOpacity
              key={f.key}
              style={[st.filterBtn, filter === f.key && st.filterBtnActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text
                style={[st.filterTxt, filter === f.key && st.filterTxtActive]}
              >
                {f.label}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    st.filterBadge,
                    filter === f.key && st.filterBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      st.filterBadgeTxt,
                      filter === f.key && { color: "#1F2937" },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={st.loadingWrap}>
          <ActivityIndicator size="large" color="#F2AB30" />
          <Text style={st.loadingTxt}>Cargando pedidos...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={st.emptyWrap}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>
            {filter === "pending" ? "⏳" : filter === "delivered" ? "✅" : "📦"}
          </Text>
          <Text style={st.emptyTitle}>
            {filter === "pending"
              ? "Sin pedidos pendientes"
              : filter === "delivered"
                ? "Sin entregas aún"
                : "No hay pedidos activos"}
          </Text>
          <Text style={st.emptySub}>
            {filter === "pending"
              ? "Cuando haya un nuevo pedido aparecerá aquí."
              : "Los pedidos entregados aparecerán aquí."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => {
                setSelected(item);
                setModalVisible(true);
              }}
              onAccept={() => handleAccept(item)}
              onAdvance={() => handleAdvance(item)}
            />
          )}
        />
      )}

      {/* Detail modal */}
      <OrderDetail
        order={selected}
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelected(null);
        }}
        onAdvance={handleAdvance}
      />

      {/* Delivery ticket */}
      <DeliveryTicketModal
        visible={ticketVisible}
        order={ticketOrder}
        onClose={() => {
          setTicketVisible(false);
          setTicketOrder(null);
        }}
      />
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D1117" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  onlineChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#064E3B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  onlineChipTxt: { fontSize: 13, fontWeight: "600", color: "#10B981" },

  earningsBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    backgroundColor: "#1F2937",
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 4,
  },
  earningsItem: { flex: 1, alignItems: "center" },
  earningsVal: { fontSize: 16, fontWeight: "800", color: "#F2AB30" },
  earningsLabel: { fontSize: 11, color: "#6B7280", marginTop: 3 },
  earningsDivider: { width: 1, backgroundColor: "#374151", marginVertical: 4 },

  filters: { maxHeight: 44 },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#1F2937",
    borderWidth: 1,
    borderColor: "#374151",
  },
  filterBtnActive: { backgroundColor: "#2D2010", borderColor: "#F2AB30" },
  filterTxt: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  filterTxtActive: { color: "#F2AB30" },
  filterBadge: {
    backgroundColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  filterBadgeActive: { backgroundColor: "#F2AB30" },
  filterBadgeTxt: { fontSize: 11, fontWeight: "800", color: "#9CA3AF" },

  card: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 4,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusTxt: { fontSize: 12, fontWeight: "700" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  orderId: { fontSize: 12, color: "#9CA3AF", flex: 1, textAlign: "right" },
  orderTime: { fontSize: 12, color: "#6B7280" },

  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  clientAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },
  clientAvatarTxt: { fontSize: 16, fontWeight: "700", color: "#F2AB30" },
  clientName: { fontSize: 14, fontWeight: "700", color: "#fff" },
  clientPhone: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  totalWrap: { alignItems: "flex-end" },
  totalAmt: { fontSize: 16, fontWeight: "800", color: "#F2AB30" },
  payMethod: { fontSize: 11, color: "#6B7280", marginTop: 2 },

  addrRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    marginBottom: 6,
  },
  addrTxt: { fontSize: 13, color: "#9CA3AF", flex: 1, lineHeight: 18 },
  itemsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginBottom: 12,
  },
  itemsTxt: { fontSize: 12, color: "#6B7280" },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  rejectBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EF4444",
    alignItems: "center",
  },
  rejectBtnTxt: { fontSize: 14, fontWeight: "700", color: "#EF4444" },
  acceptBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: "#F2AB30",
    borderRadius: 10,
  },
  acceptBtnTxt: { fontSize: 14, fontWeight: "700", color: "#1F2937" },
  advanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: "#F2AB30",
    borderRadius: 12,
    marginTop: 8,
  },
  advanceBtnTxt: { fontSize: 15, fontWeight: "800", color: "#1F2937" },

  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingTxt: { fontSize: 14, color: "#6B7280" },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1F2937",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  offlineBannerEmoji: { fontSize: 20 },
  offlineBannerTitle: { fontSize: 14, fontWeight: "700", color: "#EF4444" },
  offlineBannerSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },

  modal: { flex: 1, backgroundColor: "#0D1117" },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#374151",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
  },
  modalSection: {
    margin: 16,
    backgroundColor: "#1F2937",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#374151",
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  infoTxt: { fontSize: 14, color: "#fff", flex: 1 },
  callBtn: {
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  callBtnTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
  noteBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#2D2010",
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },
  noteTxt: { fontSize: 13, color: "#F2AB30", flex: 1 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  itemQty: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },
  itemQtyTxt: { fontSize: 12, fontWeight: "800", color: "#F2AB30" },
  itemName: { flex: 1, fontSize: 14, color: "#fff" },
  itemPrice: { fontSize: 14, fontWeight: "700", color: "#fff" },
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  payLabel: { fontSize: 14, color: "#9CA3AF" },
  payValue: { fontSize: 14, color: "#fff", fontWeight: "600" },
  payTotal: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#374151",
    marginTop: 4,
  },
  payTotalLabel: { fontSize: 15, fontWeight: "800", color: "#fff" },
  payTotalValue: { fontSize: 18, fontWeight: "800", color: "#F2AB30" },
  payMethodBox: {
    backgroundColor: "#374151",
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  payMethodTxt: { fontSize: 13, color: "#9CA3AF", textAlign: "center" },
  earningAmt: {
    fontSize: 28,
    fontWeight: "900",
    color: "#10B981",
    marginTop: 4,
  },
  earningDesc: { fontSize: 13, color: "#6EE7B7", marginTop: 4 },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: "#1F2937" },

  moduleSelector: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#111827",
  },
  moduleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#1F2937",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  moduleBtnActive: { backgroundColor: "#1C3A2B", borderColor: "#F2AB30" },
  moduleBtnActiveFarma: { backgroundColor: "#2D1B4A", borderColor: "#A78BFA" },
  moduleBtnActiveEats: { backgroundColor: "#2D2010", borderColor: "#F97316" },
  moduleBtnActiveLib: { backgroundColor: "#1F2937", borderColor: "#8B5CF6" },
  moduleBtnTxt: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  moduleBtnTxtActive: { color: "#F2AB30" },
  moduleBtnTxtActiveFarma: { color: "#A78BFA" },
  moduleBtnTxtActiveEats: { color: "#F97316" },
  moduleBtnTxtActiveLib: { color: "#8B5CF6" },
});
