import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface AppNotification {
  id: string;
  type: "ride" | "earning" | "system" | "verification";
  title: string;
  body: string;
  read: boolean;
  createdAt: any;
}

const ICON: Record<string, { name: string; color: string; bg: string }> = {
  ride: { name: "car", color: "#F2AB30", bg: "#2D2010" },
  earning: { name: "cash", color: "#10B981", bg: "#064E3B" },
  system: { name: "information-circle", color: "#3B82F6", bg: "#1E2A4A" },
  verification: { name: "shield-checkmark", color: "#8B5CF6", bg: "#2D1B4A" },
};

const fmt = (ts: any) => {
  if (!ts?.toDate) return "";
  const diff = Math.floor((Date.now() - ts.toDate().getTime()) / 60000);
  if (diff < 1) return "Ahora";
  if (diff < 60) return `${diff}m`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;
  return `${Math.floor(diff / 1440)}d`;
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "drivers", user.uid, "notifications"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification),
      );
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const markAsRead = async (notif: AppNotification) => {
    if (notif.read || !user) return;
    await updateDoc(doc(db, "drivers", user.uid, "notifications", notif.id), {
      read: true,
    });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderItem = ({ item }: { item: AppNotification }) => {
    const ico = ICON[item.type] ?? ICON.system;
    return (
      <TouchableOpacity
        style={[styles.item, !item.read && styles.itemUnread]}
        onPress={() => markAsRead(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.iconBox, { backgroundColor: ico.bg }]}>
          <Ionicons name={ico.name as any} size={20} color={ico.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.itemTop}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.itemTime}>{fmt(item.createdAt)}</Text>
          </View>
          <Text style={styles.itemBody} numberOfLines={2}>
            {item.body}
          </Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notificaciones</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator
          color="#F2AB30"
          size="large"
          style={{ marginTop: 60 }}
        />
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>🔔</Text>
          <Text style={styles.emptyTitle}>Sin notificaciones</Text>
          <Text style={styles.emptySub}>
            Aquí aparecerán tus viajes, ganancias y avisos.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#fff" },
  badge: {
    backgroundColor: "#EF4444",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  badgeTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingBottom: 60,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  emptySub: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#111827",
  },
  itemUnread: { backgroundColor: "#1F2937" },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  itemTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: "#fff" },
  itemTime: { fontSize: 11, color: "#6B7280" },
  itemBody: { fontSize: 13, color: "#9CA3AF", lineHeight: 18 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F2AB30",
    marginTop: 6,
    flexShrink: 0,
  },
  separator: { height: 1, backgroundColor: "#1F2937" },
});
