import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface TicketOrder {
  id: string;
  orderId?: string;
  module: string;
  restaurantName?: string;
  supermarketName?: string;
  sellerName?: string;
  userName?: string;
  userPhone?: string;
  deliveryAddress?: string | { text?: string; address?: string; reference?: string };
  address?: string;
  items: Array<{ name: string; qty: number; price: number }>;
  subtotal?: number;
  deliveryFee?: number;
  total: number;
  paymentMethod?: string;
  driverName?: string;
  createdAt?: any;
  deliveredAt?: any;
}

interface Props {
  visible: boolean;
  order: TicketOrder | null;
  onClose: () => void;
}

const fmt = (n: number) =>
  n.toLocaleString("es-GQ", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  });

const fmtDate = (ts: any): string => {
  if (!ts) return new Date().toLocaleString("es-GQ", { dateStyle: "medium", timeStyle: "short" });
  const d = ts.toDate?.() ?? new Date(ts);
  return d.toLocaleString("es-GQ", { dateStyle: "medium", timeStyle: "short" });
};

const getAddress = (order: TicketOrder): string => {
  if (order.address) return order.address;
  const addr = order.deliveryAddress;
  if (!addr) return "—";
  if (typeof addr === "string") return addr;
  return [(addr as any).text || (addr as any).address, (addr as any).reference]
    .filter(Boolean)
    .join(" · ");
};

const getClientName = (order: TicketOrder) =>
  (order as any).buyerName || order.userName || "Cliente";

const getSource = (order: TicketOrder) =>
  order.restaurantName || order.supermarketName || order.sellerName || "Yakoo";

const getOrderRef = (order: TicketOrder) =>
  `#${(order.orderId ?? order.id).slice(-8).toUpperCase()}`;

const qrUrl = (orderId: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=6&data=${encodeURIComponent(`YAKOO-ORDER-${orderId}`)}`;

// ── HTML receipt for print ───────────────────────────────────────────────────
const buildHtml = (order: TicketOrder): string => {
  const ref = getOrderRef(order);
  const source = getSource(order);
  const client = getClientName(order);
  const address = getAddress(order);
  const date = fmtDate(order.deliveredAt ?? order.createdAt);
  const payment =
    order.paymentMethod === "cash" ? "Efectivo" : "Yakoo Pay";
  const subtotal = order.subtotal ?? order.total - (order.deliveryFee ?? 0);
  const qr = qrUrl(order.id);

  const itemsHtml = (order.items ?? [])
    .map(
      (i) => `
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#111">${i.qty}× ${i.name}</td>
        <td style="padding:6px 0;font-size:14px;color:#111;text-align:right;font-weight:600">
          ${fmt(i.price * i.qty)}
        </td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', monospace;
      background: #fff;
      max-width: 320px;
      margin: 0 auto;
      padding: 16px;
    }
    .header { text-align: center; padding: 12px 0 8px; }
    .logo { font-size: 28px; font-weight: 900; color: #F2AB30; letter-spacing: -1px; }
    .tagline { font-size: 11px; color: #6B7280; margin-top: 2px; }
    .divider { border: none; border-top: 1px dashed #D1D5DB; margin: 10px 0; }
    .divider-solid { border: none; border-top: 2px solid #111; margin: 10px 0; }
    .ref { text-align: center; font-size: 18px; font-weight: 900; color: #111; margin: 8px 0; }
    .date { text-align: center; font-size: 12px; color: #6B7280; margin-bottom: 6px; }
    .section-title {
      font-size: 10px; font-weight: 700; color: #9CA3AF;
      text-transform: uppercase; letter-spacing: 1px; margin: 10px 0 4px;
    }
    .section-value { font-size: 14px; color: #111; }
    .section-sub { font-size: 12px; color: #6B7280; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
    .summary-row td { padding: 4px 0; font-size: 13px; color: #111; }
    .summary-row td:last-child { text-align: right; }
    .total-row td {
      padding-top: 8px; font-size: 16px; font-weight: 900;
      color: #111; border-top: 2px solid #111;
    }
    .total-row td:last-child { text-align: right; color: #F2AB30; }
    .payment { text-align: center; font-size: 12px; color: #6B7280; margin-top: 8px; }
    .qr-wrap { text-align: center; margin: 14px 0 6px; }
    .qr-wrap img { width: 140px; height: 140px; }
    .qr-label { font-size: 10px; color: #9CA3AF; text-align: center; }
    .footer { text-align: center; font-size: 11px; color: #6B7280; padding-top: 12px; line-height: 1.6; }
    .source-badge {
      display: inline-block; background: #FEF3C7; border-radius: 4px;
      padding: 2px 8px; font-size: 12px; color: #92400E; font-weight: 700;
      margin-bottom: 6px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">YAKOO</div>
    <div class="tagline">Tu pedido de confianza</div>
  </div>
  <hr class="divider-solid"/>

  <div class="ref">${ref}</div>
  <div class="date">${date}</div>
  <div style="text-align:center;margin:4px 0"><span class="source-badge">${source}</span></div>

  <hr class="divider"/>

  <div class="section-title">Cliente</div>
  <div class="section-value">${client}</div>
  ${order.userPhone ? `<div class="section-sub">📞 ${order.userPhone}</div>` : ""}
  ${address !== "—" ? `<div class="section-sub">📍 ${address}</div>` : ""}

  <hr class="divider"/>

  <div class="section-title">Productos</div>
  <table>
    <tbody>${itemsHtml}</tbody>
  </table>

  <hr class="divider"/>

  <table>
    <tbody>
      <tr class="summary-row"><td>Subtotal</td><td>${fmt(subtotal)}</td></tr>
      ${order.deliveryFee ? `<tr class="summary-row"><td>Envío</td><td>${fmt(order.deliveryFee)}</td></tr>` : ""}
      <tr class="total-row"><td>TOTAL</td><td>${fmt(order.total)}</td></tr>
    </tbody>
  </table>
  <div class="payment">Método de pago: ${payment}</div>

  <hr class="divider"/>

  <div class="qr-wrap">
    <img src="${qr}" alt="QR"/>
  </div>
  <div class="qr-label">YAKOO-ORDER-${order.id.toUpperCase()}</div>

  <hr class="divider"/>

  <div class="footer">
    Entregado por: ${order.driverName ?? "Yakoo Driver"}<br/>
    ¡Gracias por tu compra!<br/>
    www.yakoo.com
  </div>
</body>
</html>`;
};

// ── Component ────────────────────────────────────────────────────────────────
export default function DeliveryTicketModal({ visible, order, onClose }: Props) {
  if (!order) return null;

  const ref = getOrderRef(order);
  const source = getSource(order);
  const client = getClientName(order);
  const address = getAddress(order);
  const date = fmtDate(order.deliveredAt ?? order.createdAt);
  const subtotal = order.subtotal ?? order.total - (order.deliveryFee ?? 0);

  const handlePrint = async () => {
    try {
      const html = buildHtml(order);
      if (Platform.OS === "web") {
        Alert.alert("Imprimir", "La impresión no está disponible en web.");
        return;
      }
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert("Error", "No se pudo abrir el diálogo de impresión.");
    }
  };

  const handleShare = async () => {
    try {
      const html = buildHtml(order);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Ticket ${ref}`,
        });
      } else {
        Alert.alert("No disponible", "No se puede compartir en este dispositivo.");
      }
    } catch {
      Alert.alert("Error", "No se pudo compartir el ticket.");
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={st.root}>
        {/* Top bar */}
        <View style={st.topBar}>
          <Text style={st.topTitle}>Ticket de entrega</Text>
          <TouchableOpacity style={st.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="#1F2937" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
          {/* Receipt card */}
          <View style={st.receipt}>
            {/* Header */}
            <View style={st.receiptHeader}>
              <Text style={st.receiptLogo}>YAKOO</Text>
              <Text style={st.receiptTagline}>Tu pedido de confianza</Text>
            </View>

            <View style={st.dashes} />

            {/* Ref + source */}
            <Text style={st.receiptRef}>{ref}</Text>
            <Text style={st.receiptDate}>{date}</Text>
            <View style={st.sourceBadge}>
              <Text style={st.sourceBadgeTxt}>{source}</Text>
            </View>

            <View style={st.dashes} />

            {/* Customer */}
            <Text style={st.sectionTitle}>CLIENTE</Text>
            <Text style={st.sectionVal}>{client}</Text>
            {order.userPhone ? (
              <Text style={st.sectionSub}>📞 {order.userPhone}</Text>
            ) : null}
            {address !== "—" ? (
              <Text style={st.sectionSub}>📍 {address}</Text>
            ) : null}

            <View style={st.dashes} />

            {/* Items */}
            <Text style={st.sectionTitle}>PRODUCTOS</Text>
            {(order.items ?? []).map((item, i) => (
              <View key={i} style={st.itemRow}>
                <Text style={st.itemQty}>{item.qty}×</Text>
                <Text style={st.itemName}>{item.name}</Text>
                <Text style={st.itemPrice}>{fmt(item.price * item.qty)}</Text>
              </View>
            ))}

            <View style={st.dashes} />

            {/* Summary */}
            <View style={st.summaryRow}>
              <Text style={st.summaryLabel}>Subtotal</Text>
              <Text style={st.summaryVal}>{fmt(subtotal)}</Text>
            </View>
            {order.deliveryFee ? (
              <View style={st.summaryRow}>
                <Text style={st.summaryLabel}>Envío</Text>
                <Text style={st.summaryVal}>{fmt(order.deliveryFee)}</Text>
              </View>
            ) : null}
            <View style={[st.summaryRow, st.totalRow]}>
              <Text style={st.totalLabel}>TOTAL</Text>
              <Text style={st.totalVal}>{fmt(order.total)}</Text>
            </View>
            <Text style={st.paymentTxt}>
              {order.paymentMethod === "cash"
                ? "💵 Pago en efectivo"
                : "📱 Pagado con Yakoo Pay"}
            </Text>

            <View style={st.dashes} />

            {/* QR code */}
            <View style={st.qrWrap}>
              <Image
                source={{ uri: qrUrl(order.id) }}
                style={st.qrImg}
                resizeMode="contain"
              />
              <Text style={st.qrLabel}>
                YAKOO-ORDER-{order.id.slice(-8).toUpperCase()}
              </Text>
            </View>

            <View style={st.dashes} />

            {/* Footer */}
            <Text style={st.footerLine}>
              Repartidor: {order.driverName ?? "Yakoo Driver"}
            </Text>
            <Text style={st.footerThank}>¡Gracias por tu compra!</Text>
            <Text style={st.footerSite}>www.yakoo.com</Text>
          </View>
        </ScrollView>

        {/* Action buttons */}
        <View style={st.actions}>
          <TouchableOpacity style={st.shareBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={18} color="#F2AB30" />
            <Text style={st.shareBtnTxt}>Compartir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.printBtn} onPress={handlePrint}>
            <Ionicons name="print-outline" size={18} color="#1F2937" />
            <Text style={st.printBtnTxt}>Imprimir ticket</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F3F4F6" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  topTitle: { fontSize: 17, fontWeight: "800", color: "#1F2937" },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: { padding: 16, paddingBottom: 24 },

  // Receipt
  receipt: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  receiptHeader: { alignItems: "center", paddingBottom: 12 },
  receiptLogo: {
    fontSize: 30,
    fontWeight: "900",
    color: "#F2AB30",
    letterSpacing: -1,
  },
  receiptTagline: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  dashes: {
    borderStyle: "dashed",
    borderTopWidth: 1,
    borderColor: "#D1D5DB",
    marginVertical: 12,
  },

  receiptRef: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  receiptDate: { fontSize: 12, color: "#9CA3AF", textAlign: "center", marginTop: 4 },
  sourceBadge: {
    alignSelf: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
  },
  sourceBadgeTxt: { fontSize: 12, fontWeight: "700", color: "#92400E" },

  sectionTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  sectionVal: { fontSize: 15, fontWeight: "700", color: "#111827" },
  sectionSub: { fontSize: 13, color: "#6B7280", marginTop: 3 },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    gap: 8,
  },
  itemQty: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6B7280",
    width: 28,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  itemName: { flex: 1, fontSize: 14, color: "#1F2937" },
  itemPrice: { fontSize: 14, fontWeight: "700", color: "#1F2937" },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  summaryLabel: { fontSize: 13, color: "#6B7280" },
  summaryVal: { fontSize: 13, color: "#1F2937", fontWeight: "600" },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: "#111827",
    marginTop: 4,
    paddingTop: 8,
  },
  totalLabel: { fontSize: 16, fontWeight: "900", color: "#111827" },
  totalVal: { fontSize: 18, fontWeight: "900", color: "#F2AB30" },
  paymentTxt: { fontSize: 12, color: "#9CA3AF", textAlign: "center", marginTop: 8 },

  qrWrap: { alignItems: "center", paddingVertical: 4 },
  qrImg: { width: 150, height: 150 },
  qrLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 6,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    letterSpacing: 0.5,
  },

  footerLine: { fontSize: 12, color: "#6B7280", textAlign: "center" },
  footerThank: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginTop: 4,
  },
  footerSite: { fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 4 },

  // Bottom actions
  actions: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#F2AB30",
  },
  shareBtnTxt: { fontSize: 15, fontWeight: "700", color: "#F2AB30" },
  printBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F2AB30",
  },
  printBtnTxt: { fontSize: 15, fontWeight: "800", color: "#1F2937" },
});
