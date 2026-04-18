import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Human-readable relative time: "just now", "5m ago", "3h ago", "2d ago" */
const relativeTime = (isoString) => {
  if (!isoString) return '';
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return 'Just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days  < 7)  return `${days}d ago`;
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (_) {
    return '';
  }
};

/** Icon char + color for each notification type */
const TYPE_META = {
  order_placed:    { icon: '🛍️',  dot: '#10B981', label: 'Order Placed'     },
  order_purchased: { icon: '✅',  dot: '#3B82F6', label: 'Purchase Confirmed' },
  order_canceled:  { icon: '❌',  dot: '#EF4444', label: 'Order Canceled'    },
};
const DEFAULT_META = { icon: '🔔', dot: '#6366F1', label: 'Notification' };

const getMeta = (type) => TYPE_META[type] ?? DEFAULT_META;

// ── Single notification card ──────────────────────────────────────────────────

function NotificationCard({ item }) {
  const navigation = useNavigation();
  const meta = getMeta(item?.type);

  const handlePress = () => {
    if (item?.order_id) {
      // Navigate to order detail if order_id is present
      try {
        navigation.navigate('OrderDetail', { orderId: item.order_id });
      } catch (_) {
        // OrderDetail screen may not exist in all builds — silently ignore
      }
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={item?.order_id ? 0.75 : 1}
      onPress={handlePress}
      disabled={!item?.order_id}
    >
      {/* Left: icon circle */}
      <View style={[styles.iconCircle, { backgroundColor: meta.dot + '20' }]}>
        <Text style={styles.iconText}>{meta.icon}</Text>
      </View>

      {/* Middle: title + body */}
      <View style={styles.textArea}>
        <Text style={styles.title} numberOfLines={1}>
          {item?.title || meta.label}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {item?.body || ''}
        </Text>
      </View>

      {/* Right: time + dot */}
      <View style={styles.rightCol}>
        <Text style={styles.time}>{relativeTime(item?.created_at)}</Text>
        <View style={[styles.typeDot, { backgroundColor: meta.dot }]} />
      </View>
    </TouchableOpacity>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NotificationList({
  notifications = [],
  loading = false,
  onRefresh,
  bottomPad = 0,
}) {
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading notifications…</Text>
      </View>
    );
  }

  if (!notifications.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>🔔</Text>
        <Text style={styles.emptyTitle}>You're all caught up!</Text>
        <Text style={styles.emptyBody}>
          No new notifications right now.{'\n'}We'll let you know when something arrives.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.list}
      contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header row */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>Notifications</Text>
        <Text style={styles.listHeaderCount}>{notifications.length}</Text>
      </View>

      {notifications.map((item) => (
        <NotificationCard key={String(item?.id ?? Math.random())} item={item} />
      ))}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Loading / empty states
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  listHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  listHeaderCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: {
    fontSize: 20,
  },
  textArea: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 20,
  },
  body: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  time: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
