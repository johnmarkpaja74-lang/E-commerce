import { useAuthStore } from '@/src/features/auth/state/authStore';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useCartStore } from '@/src/features/cart/state/cartStore';
import { getDatabase } from '@/src/services/storage/sqlite/db';
import { runMigrations } from '@/src/services/storage/sqlite/migrations';

type ProfileSettings = {
  address: string;
  notificationsEnabled: boolean;
  trustedDevice: boolean;
  lastPasswordUpdate: string | null;
};

type ProfilePrefs = {
  displayName: string | null;
  avatarUrl: string | null;
  headerBackgroundColor: string | null;
};
const DEFAULT_AVATAR_URL =
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=60';

const DEFAULT_SETTINGS: ProfileSettings = {
  address: '123 Main Street, New York, USA',
  notificationsEnabled: true,
  trustedDevice: true,
  lastPasswordUpdate: null,
};

const SECTION_CONFIG: Record<string, { title: string; description: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  orders: { title: 'Orders', description: 'Open your cart to manage current order items.', icon: 'receipt-long' },
  wishlist: { title: 'Wishlist', description: 'Add a saved item directly to your cart.', icon: 'favorite-border' },
  addresses: { title: 'Addresses', description: 'Update your delivery address.', icon: 'place' },
  account: { title: 'Account', description: 'Update your display name.', icon: 'groups' },
  notifications: { title: 'Notifications', description: 'Turn app notifications on or off.', icon: 'notifications' },
  passwords: { title: 'Passwords', description: 'Set a new password for your account.', icon: 'vpn-key' },
  bag: { title: 'Bag', description: 'Open your cart bag.', icon: 'shopping-bag' },
};

const THEME_COLORS = ['#FF6700', '#6366f1', '#10b981', '#f43f5e', '#334155'];

function ensureProfileTables(): void {
  const db = getDatabase();

  // Migration: Check if 'trusted_device' column exists. If not, reset tables.
  try {
    db.getFirstSync('SELECT trusted_device FROM profile_settings LIMIT 1;');
    db.getFirstSync('SELECT header_background_color FROM profile_preferences LIMIT 1;');
  } catch (e) {
    try {
      db.execSync('DROP TABLE IF EXISTS profile_preferences;');
      db.execSync('DROP TABLE IF EXISTS profile_settings;');
    } catch (inner) { /* ignore */ }
  }

  db.execSync(`
    CREATE TABLE IF NOT EXISTS profile_preferences (
      user_id TEXT PRIMARY KEY,
      display_name TEXT,
      avatar_url TEXT,
      hero_background_url TEXT,
      header_background_color TEXT
    );

    CREATE TABLE IF NOT EXISTS profile_settings (
      user_id TEXT PRIMARY KEY,
      address TEXT NOT NULL DEFAULT '123 Main Street, New York, USA',
      notifications_enabled INTEGER NOT NULL DEFAULT 1,
      trusted_device INTEGER NOT NULL DEFAULT 1,
      last_password_update TEXT
    );

    CREATE TABLE IF NOT EXISTS wishlist (
      user_id TEXT,
      product_id TEXT,
      name TEXT,
      price REAL,
      image_url TEXT,
      PRIMARY KEY(user_id, product_id)
    );
  `);
}

function loadSettings(userId: string): ProfileSettings {
  const db = getDatabase();
  const row = db.getFirstSync<{
    address: string;
    notifications_enabled: number;
    trusted_device: number;
    last_password_update: string | null;
  }>('SELECT address, notifications_enabled, trusted_device, last_password_update FROM profile_settings WHERE user_id = ?;', [userId]);

  if (!row) {
    return DEFAULT_SETTINGS;
  }

  return {
    address: row.address || DEFAULT_SETTINGS.address,
    notificationsEnabled: row.notifications_enabled === 1,
    trustedDevice: row.trusted_device === 1,
    lastPasswordUpdate: row.last_password_update,
  };
}

function saveSettings(userId: string, settings: ProfileSettings): void {
  const db = getDatabase();
  db.runSync(
    `
      INSERT INTO profile_settings (user_id, address, notifications_enabled, trusted_device, last_password_update)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        address = excluded.address,
        notifications_enabled = excluded.notifications_enabled,
        trusted_device = excluded.trusted_device,
        last_password_update = excluded.last_password_update;
    `,
    [
      userId,
      settings.address,
      settings.notificationsEnabled ? 1 : 0,
      settings.trustedDevice ? 1 : 0,
      settings.lastPasswordUpdate,
    ]
  );
}

function loadProfilePrefs(userId: string): ProfilePrefs {
  const db = getDatabase();
  const row = db.getFirstSync<{ display_name: string | null; avatar_url: string | null; header_background_color: string | null }>(
    'SELECT display_name, avatar_url, header_background_color FROM profile_preferences WHERE user_id = ?;', [userId]
  );
  return {
    displayName: row?.display_name ?? null,
    avatarUrl: row?.avatar_url ?? null,
    headerBackgroundColor: row?.header_background_color ?? null,
  };
}

function saveProfilePrefs(userId: string, prefs: ProfilePrefs): void {
  const db = getDatabase();
  db.runSync(
    `
      INSERT INTO profile_preferences (user_id, display_name, avatar_url, header_background_color)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        header_background_color = excluded.header_background_color;
    `, [userId, prefs.displayName, prefs.avatarUrl, prefs.headerBackgroundColor]
  );
}

function loadWishlist(userId: string) {
  const db = getDatabase();
  return db.getAllSync<{
    id: string;
    name: string;
    price: number;
    imageUrl: string;
  }>(
    'SELECT product_id as id, name, price, image_url as imageUrl FROM wishlist WHERE user_id = ?;',
    [userId]
  );
}

function removeFromWishlist(userId: string, productId: string): void {
  const db = getDatabase();
  db.runSync('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?;', [userId, productId]);
}

function addToWishlist(userId: string, product: any): void {
  const db = getDatabase();
  db.runSync(
    'INSERT OR REPLACE INTO wishlist (user_id, product_id, name, price, image_url) VALUES (?, ?, ?, ?, ?);',
    [userId, product.id, product.name, product.price, product.imageUrl]
  );
}

export default function ProfileSectionScreen() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section: string }>();
  const session = useAuthStore((state) => state.session);
  const addItem = useCartStore((state) => state.addItem);
  const initializeFromDatabase = useCartStore((state) => state.initializeFromDatabase);

  const [settings, setSettings] = useState<ProfileSettings>(DEFAULT_SETTINGS);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [headerBgColor, setHeaderBgColor] = useState<string | null>(null);
  const [photoDraft, setPhotoDraft] = useState('');
  const [addressDraft, setAddressDraft] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);

  useEffect(() => {
    runMigrations();
    ensureProfileTables();
    if (session?.id) {
      try {
        const loadedSettings = loadSettings(session.id);
        const loadedPrefs = loadProfilePrefs(session.id);
        setSettings(loadedSettings);
        setAddressDraft(loadedSettings.address);
        setDisplayName(loadedPrefs.displayName ?? session.displayName ?? '');
        const activeAvatar = loadedPrefs.avatarUrl || session.photoURL || DEFAULT_AVATAR_URL;
        setAvatarUrl(activeAvatar);
        setHeaderBgColor(loadedPrefs.headerBackgroundColor);
        setPhotoDraft(activeAvatar);
        
        if (key === 'wishlist') {
          setWishlistItems(loadWishlist(session.id));
        }

        void initializeFromDatabase();
      } catch (e) {
        console.error('Section load error:', e);
        Alert.alert('Error', 'Could not load your data. Please try again later.');
      }
    }
  }, [initializeFromDatabase, session, key]);

  const refreshWishlist = useCallback(() => {
    if (session?.id) setWishlistItems(loadWishlist(session.id));
  }, [session?.id]);

  const key = (section ?? '').toLowerCase();
  const config = SECTION_CONFIG[key] ?? {
    title: 'Profile Section',
    description: 'This section is ready for content.',
    icon: 'person',
  };

  const nowString = useMemo(() => new Date().toLocaleString(), []);

  function saveAndSet(next: ProfileSettings): void {
    try {
      setSettings(next);
      if (session?.id) saveSettings(session.id, next);
    } catch (e) {
      console.error('Save settings error:', e);
      Alert.alert('Save Failed', 'Changes could not be saved to your device.');
    }
  }

  async function pickPhotoFromLibrary(): Promise<void> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to update your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    const nextPhoto = result.assets[0].uri;
    setAvatarUrl(nextPhoto);
    setPhotoDraft(nextPhoto);
    if (session?.id) saveProfilePrefs(session.id, { 
      displayName: displayName.trim() || null, 
      avatarUrl: nextPhoto,
      headerBackgroundColor: headerBgColor 
    });
    Alert.alert('Saved', 'Profile photo updated.');
  }

  async function handleWishlistToCart(item: any): Promise<void> {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addItem({ id: item.id, name: item.name, price: item.price, imageUrl: item.imageUrl });
    Alert.alert('Added to cart', `${item.name} is ready for checkout.`);
  }

  function handleRemoveWishlist(productId: string): void {
    if (!session?.id) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      removeFromWishlist(session.id, productId);
      refreshWishlist();
    } catch (e) {
      Alert.alert('Error', 'Could not remove item.');
    }
  }

  function saveAccountChanges(): void {
    const nextName = displayName.trim();

    if (!nextName) {
      Alert.alert('Invalid name', 'Please enter a display name.');
      return;
    }

    const finalAvatarUrl = photoDraft.trim() || null;
    setAvatarUrl(finalAvatarUrl);
    if (session?.id) saveProfilePrefs(session.id, { 
      displayName: nextName, 
      avatarUrl: finalAvatarUrl,
      headerBackgroundColor: headerBgColor
    });
    Alert.alert('Saved', 'Account changes updated.');
  }

  function renderSectionContent() {
    if (key === 'orders' || key === 'bag') {
      return (
        <Pressable style={styles.actionBtn} onPress={() => router.push('/cart')}>
          <Text style={styles.actionBtnText}>Open Cart</Text>
        </Pressable>
      );
    }

    if (key === 'wishlist') {
      if (wishlistItems.length === 0) {
        return (
          <View style={styles.emptyState}>
            <MaterialIcons name="favorite-border" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>Your wishlist is empty</Text>
            <Pressable style={styles.pickBtn} onPress={() => router.push('/')}>
              <Text style={styles.pickBtnText}>Go Shopping</Text>
            </Pressable>
          </View>
        );
      }

      return (
        <View style={styles.wishlistList}>
          {wishlistItems.map((item) => (
            <View key={item.id} style={styles.wishlistItem}>
              <Image source={{ uri: item.imageUrl }} style={styles.wishlistImage} />
              <View style={styles.wishlistMeta}>
                <Text style={styles.wishlistName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.wishlistPrice}>${item.price.toFixed(2)}</Text>
                <View style={styles.wishlistActions}>
                  <Pressable style={styles.wishlistCartBtn} onPress={() => void handleWishlistToCart(item)}>
                    <MaterialIcons name="add-shopping-cart" size={16} color="#fff" />
                    <Text style={styles.wishlistBtnText}>Add to Cart</Text>
                  </Pressable>
                  <Pressable style={styles.wishlistRemoveBtn} onPress={() => handleRemoveWishlist(item.id)}>
                    <MaterialIcons name="delete-outline" size={18} color="#ef4444" />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (key === 'addresses') {
      return (
        <View style={styles.formBlock}>
          <TextInput value={addressDraft} onChangeText={setAddressDraft} style={styles.input} placeholder="Delivery address" />
          <Pressable
            style={styles.actionBtn}
            onPress={() => {
              const value = addressDraft.trim();
              if (!value) {
                Alert.alert('Invalid address', 'Please enter an address.');
                return;
              }
              saveAndSet({ ...settings, address: value });
              Alert.alert('Saved', 'Address updated.');
            }}>
            <Text style={styles.actionBtnText}>Save Address</Text>
          </Pressable>
        </View>
      );
    }

    if (key === 'account') {
      const resolvedAvatar = avatarUrl || session?.photoURL || DEFAULT_AVATAR_URL;
      return (
        <View style={styles.formBlock}>
          <View style={styles.avatarEditorWrap}>
            <Image source={resolvedAvatar} style={styles.avatarPreview} transition={200} />
            <Pressable style={styles.pickBtn} onPress={() => void pickPhotoFromLibrary()}>
              <Text style={styles.pickBtnText}>Choose From Gallery</Text>
            </Pressable>
          </View>

          <Text style={[styles.description, { marginTop: 8, fontWeight: '700' }]}>Header Theme</Text>
          <View style={styles.choiceRow}>
            {THEME_COLORS.map((color) => (
              <Pressable
                key={color}
                style={[
                  styles.colorChip, 
                  { backgroundColor: color },
                  headerBgColor === color && styles.colorChipActive
                ]}
                onPress={() => setHeaderBgColor(color)}
              />
            ))}
          </View>

          <TextInput value={displayName} onChangeText={setDisplayName} style={styles.input} placeholder="Display name" />
          <Pressable
            style={styles.actionBtn}
            onPress={saveAccountChanges}>
            <Text style={styles.actionBtnText}>Save Changes</Text>
          </Pressable>
        </View>
      );
    }

    if (key === 'notifications') {
      return (
        <Pressable
          style={styles.actionBtn}
          onPress={() => {
            const next = !settings.notificationsEnabled;
            saveAndSet({ ...settings, notificationsEnabled: next });
            Alert.alert('Updated', `Notifications ${next ? 'enabled' : 'disabled'}.`);
          }}>
          <Text style={styles.actionBtnText}>{settings.notificationsEnabled ? 'Turn Off Notifications' : 'Turn On Notifications'}</Text>
        </Pressable>
      );
    }

    if (key === 'passwords') {
      return (
        <View style={styles.formBlock}>
          <View style={styles.passwordInputWrapper}>
            <TextInput
              value={passwordDraft}
              onChangeText={setPasswordDraft}
              style={[styles.input, { flex: 1 }]}
              placeholder="New password (min 6 chars)"
              secureTextEntry={!isPasswordVisible}
            />
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            >
              <MaterialIcons
                name={isPasswordVisible ? 'visibility' : 'visibility-off'}
                size={20}
                color="#94a3b8"
              />
            </Pressable>
          </View>
          <Pressable
            style={styles.actionBtn}
            onPress={() => {
              if (passwordDraft.trim().length < 6) {
                Alert.alert('Invalid password', 'Password must be at least 6 characters.');
                return;
              }
              saveAndSet({ ...settings, lastPasswordUpdate: nowString });
              setPasswordDraft('');
              Alert.alert('Saved', 'Password updated.');
            }}>
            <Text style={styles.actionBtnText}>Update Password</Text>
          </Pressable>
        </View>
      );
    }

    return null;
  }

  return (
    <View style={styles.page}>
      <View style={styles.topBar}>
        <Pressable style={styles.topBackBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={18} color="#1f2937" />
          <Text style={styles.topBackText}>Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>{config.title}</Text>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <MaterialIcons name={config.icon} size={34} color="#FF6700" />
          <Text style={styles.description}>{config.description}</Text>

          {renderSectionContent()}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f7f3f3' },
  topBar: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#f7f3f3',
    borderBottomWidth: 1,
    borderBottomColor: '#f1dede',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBackBtn: {
    minWidth: 70,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  topBackText: { color: '#1f2937', fontWeight: '700', fontSize: 12 },
  topTitle: { color: '#111827', fontSize: 20, fontWeight: '800' },
  topSpacer: { minWidth: 70 },
  scrollContent: { padding: 16, paddingTop: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffdede',
    padding: 18,
    gap: 10,
  },
  description: { color: '#6b7280', fontSize: 15 },
  formBlock: { gap: 8 },
  avatarEditorWrap: { alignItems: 'center', gap: 8, marginBottom: 2 },
  avatarPreview: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: '#ffd3d3',
  },
  pickBtn: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ffbcbc',
    backgroundColor: '#fff5f5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pickBtnText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ffd3d3',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff8f8',
    color: '#0f172a',
  },
  actionBtn: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#FF6700',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionBtnText: { color: '#fff', fontWeight: '800' },
  choiceRow: { flexDirection: 'row', gap: 10 },
  choiceBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffd3d3',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceBtnActive: { backgroundColor: '#FF6700', borderColor: '#FF6700' },
  choiceText: { color: '#374151', fontWeight: '700' },
  choiceTextActive: { color: '#fff' },
  colorChip: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: 'transparent' },
  colorChipActive: { borderColor: '#1f2937' },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  passwordToggle: {
    position: 'absolute',
    right: 14,
  },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
  wishlistList: { gap: 16 },
  wishlistItem: { flexDirection: 'row', gap: 12, backgroundColor: '#f8fafc', borderRadius: 12, padding: 10 },
  wishlistImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#e2e8f0' },
  wishlistMeta: { flex: 1, justifyContent: 'space-between' },
  wishlistName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  wishlistPrice: { fontSize: 14, fontWeight: '600', color: '#FF6700' },
  wishlistActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wishlistCartBtn: { backgroundColor: '#FF6700', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
  wishlistBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  wishlistRemoveBtn: { padding: 4 },
});
