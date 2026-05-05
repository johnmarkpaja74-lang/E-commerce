import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import * as Google from 'expo-auth-session/providers/google';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuthStore } from '@/src/features/auth/state/authStore';
import { getDatabase } from '@/src/services/storage/sqlite/db';
import { runMigrations } from '@/src/services/storage/sqlite/migrations';

WebBrowser.maybeCompleteAuthSession();

type MenuItem = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
};

type QuickAction = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
};

type ProfilePreferences = {
  displayName: string | null;
  avatarUrl: string | null;
  headerBackgroundColor: string | null;
};

type AuthMode = 'login' | 'register';

type ProfileSettingsSnapshot = {
  address: string;
  notificationsEnabled: boolean;
  trustedDevice: boolean;
  lastPasswordUpdate: string | null; // Removed language
};

const DEFAULT_AVATAR_URL =
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=60';

const DEFAULT_SETTINGS: ProfileSettingsSnapshot = {
  address: '123 Main Street, New York, USA',
  notificationsEnabled: true,
  trustedDevice: true,
  lastPasswordUpdate: null, // Removed language
};

const PRIMARY_MENU: MenuItem[] = [
  { icon: 'place', label: 'My Address' },
  { icon: 'groups', label: 'Account' },
];

const SECONDARY_MENU: MenuItem[] = [
  { icon: 'notifications', label: 'Notifications' },
  { icon: 'vpn-key', label: 'Passwords' },
];

const QUICK_ACTIONS: QuickAction[] = [
  { icon: 'receipt-long', label: 'Orders' },
  { icon: 'favorite-border', label: 'Wishlist' },
  { icon: 'place', label: 'Addresses' },
];

function ensureProfileTables(): void {
  const database = getDatabase();

  // Migration: Check if 'trusted_device' column exists. If not, reset tables to ensure consistency.
  try {
    database.getFirstSync('SELECT trusted_device FROM profile_settings LIMIT 1;');
    database.getFirstSync('SELECT header_background_color FROM profile_preferences LIMIT 1;');
  } catch {
    try {
      database.execSync('DROP TABLE IF EXISTS profile_preferences;');
      database.execSync('DROP TABLE IF EXISTS profile_settings;');
    } catch { /* ignore */ }
  }

  database.execSync(`
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
  `);
}

// This function is now only responsible for loading, not schema management
function loadProfilePreferences(userId: string): ProfilePreferences {
  const database = getDatabase();
  const row = database.getFirstSync<{ display_name: string | null; avatar_url: string | null; header_background_color: string | null }>(
    'SELECT display_name, avatar_url, header_background_color FROM profile_preferences WHERE user_id = ?;',
    [userId]
  );
  return {
    displayName: row?.display_name ?? null,
    avatarUrl: row?.avatar_url ?? null,
    headerBackgroundColor: row?.header_background_color ?? null,
  };
}

// This function is now only responsible for loading, not schema management
function loadProfileSettings(userId: string): ProfileSettingsSnapshot {
  const database = getDatabase();
  const row = database.getFirstSync<{
    address: string;
    notifications_enabled: number;
    trusted_device: number;
    last_password_update: string | null;
  }>('SELECT address, notifications_enabled, trusted_device, last_password_update FROM profile_settings WHERE user_id = ?;', [
    userId,
  ]);

  return {
    address: row?.address ?? '123 Main Street, New York, USA',
    notificationsEnabled: row?.notifications_enabled === 1,
    trustedDevice: row?.trusted_device === 1,
    lastPasswordUpdate: row?.last_password_update ?? null,
  };
}

function SettingsRow({ icon, label, onPress }: MenuItem & { onPress: () => void }) {
  return (
    <Pressable style={styles.rowButton} onPress={onPress}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIconWrap}>
          <MaterialIcons name={icon} size={18} color="#FF6700" />
        </View>
        <Text style={styles.rowText}>{label}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#c7c9cf" />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const logout = useAuthStore((state) => state.logout);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const clearError = useAuthStore((state) => state.clearError);

  // Google Auth Request Hook
  const [, response, promptAsync] = Google.useAuthRequest({
    iosClientId: '581497630541-ios.apps.googleusercontent.com',
    androidClientId: '581497630541-android.apps.googleusercontent.com',
    webClientId: '581497630541-web.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.idToken) {
      const { idToken } = response.authentication;
      void loginWithGoogle(idToken);
    } else if (response?.type === 'error') {
      Alert.alert('Login Error', 'Could not authenticate with Google.');
    }
  }, [response, loginWithGoogle]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [address, setAddress] = useState('123 Main Street, New York, USA');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true); // Removed language state
  const [lastPasswordUpdate, setLastPasswordUpdate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const hydrateProfile = useCallback(() => {
    if (!session?.id) {
      setProfileDisplayName(null);
      setAvatarUrl(null);
      setAddress(DEFAULT_SETTINGS.address);
      setNotificationsEnabled(DEFAULT_SETTINGS.notificationsEnabled);
      setLastPasswordUpdate(null);
      return;
    }
    try {
      const prefs = loadProfilePreferences(session.id);
      setProfileDisplayName(prefs.displayName);
      setAvatarUrl(prefs.avatarUrl);
      const settings = loadProfileSettings(session.id);
      setAddress(settings.address);
      setNotificationsEnabled(settings.notificationsEnabled);
      setLastPasswordUpdate(settings.lastPasswordUpdate);
    } catch (e) {
      console.error('Failed to load local profile:', e);
      Alert.alert('Database Error', 'Could not load local settings. Using defaults instead.');
    }
  }, [session?.id]);

  useEffect(() => {
    // Run migrations and ensure tables once on component mount
    runMigrations();
    ensureProfileTables();
    restoreSession(); // Restore session first
  }, [restoreSession]);

  useEffect(() => {
    // Hydrate profile whenever session changes
    hydrateProfile();
  }, [hydrateProfile, session]); // Depend on the entire session object

  useFocusEffect(
    useCallback(() => {
      hydrateProfile();
    }, [hydrateProfile])
  );

  const resolvedName = useMemo(() => {
    if (profileDisplayName && profileDisplayName.trim().length > 0) {
      return profileDisplayName.trim();
    }
    return session?.displayName ?? session?.email?.split('@')[0] ?? 'Guest';
  }, [profileDisplayName, session?.email, session?.displayName]);

  // Prioritize local avatar, then Firebase photoURL, then a generic default
  const resolvedAvatar = useMemo(() => avatarUrl || session?.photoURL || DEFAULT_AVATAR_URL, [
    avatarUrl,
    session?.photoURL,
  ]);

  function openSection(section: string): void {
    router.push(`/profile/${section}` as Href);
  }

  async function handleLogin(): Promise<void> {
    clearError();
    if (authMode === 'login') {
      await login(email, password);
    } else if (authMode === 'register') {
      await register(email, password, displayNameInput);
    }
  }

  async function handleGoogleSignIn(): Promise<void> {
    void promptAsync();
  }

  async function handleForgotPassword(): Promise<void> {
    if (!email.includes('@')) {
      Alert.alert('Email Required', 'Please enter your email address to reset your password.');
      return;
    }
    try {
      await resetPassword(email);
      Alert.alert('Email Sent', 'Check your inbox for instructions to reset your password.');
    } catch {
      // Error is handled by the store
    }
  }

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    try {
      await restoreSession();
      // hydrateProfile will be called by the useEffect when session changes
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (session) {
      setDisplayNameInput(session.displayName ?? '');
    } else {
      setDisplayNameInput('');
    }
  }, [session]);

  if (session) {
    return (
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <View style={styles.hero}>
            <View style={styles.heroOverlay}>
              <View style={styles.heroTopActions}>
                <Pressable
                  style={styles.heroIconButton}
                  onPress={() => openSection('wishlist')}>
                  <MaterialIcons name="favorite-border" size={22} color="#ffffff" />
                </Pressable>
                <Pressable
                  style={styles.heroIconButton}
                  onPress={() => openSection('bag')}>
                  <MaterialIcons name="shopping-bag" size={22} color="#ffffff" />
                  <View style={styles.badgeDot} />
                </Pressable>
              </View>

              <View style={styles.profileCenterWrap}>
                <View>
                  <Image source={resolvedAvatar} style={styles.avatar} transition={200} />
                </View>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{resolvedName}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.actionPanel}>
            <View style={styles.quickActionRow}>
              {QUICK_ACTIONS.map((action) => (
                <Pressable
                  key={action.label}
                  style={styles.quickActionButton}
                  onPress={() => {
                    if (action.label === 'Orders') {
                      openSection('orders');
                      return;
                    }
                    if (action.label === 'Wishlist') {
                      openSection('wishlist');
                      return;
                    }
                    openSection('addresses');
                  }}>
                  <MaterialIcons name={action.icon} size={18} color="#ff4d4f" />
                  <Text style={styles.quickActionLabel}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.groupCardTop}>
            {PRIMARY_MENU.map((item, idx) => (
              <View key={item.label}>
                <SettingsRow
                  icon={item.icon}
                  label={item.label}
                  onPress={() => {
                    if (item.label === 'My Address') {
                      openSection('addresses');
                      return;
                    }
                    openSection('account');
                  }}
                />
                {idx < PRIMARY_MENU.length - 1 ? <View style={styles.separator} /> : null}
              </View>
            ))}
          </View>

          <View style={styles.groupCardBottom}>
            {SECONDARY_MENU.map((item, idx) => (
              <View key={item.label}>
                <SettingsRow
                  icon={item.icon}
                  label={item.label}
                  onPress={() => {
                    if (item.label === 'Notifications') {
                      openSection('notifications');
                      return;
                    }
                    if (item.label === 'Passwords') {
                      openSection('passwords');
                      return;
                    }
                  }}
                />
                {idx < SECONDARY_MENU.length - 1 ? <View style={styles.separator} /> : null}
              </View>
            ))}
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusText}>Address: {address}</Text>
            <Text style={styles.statusText}>Notifications: {notificationsEnabled ? 'On' : 'Off'}</Text>
            <Text style={styles.statusText}>Password Updated: {lastPasswordUpdate ?? 'Not yet'}</Text>
          </View>

          <View style={styles.logoutWrap}>
            <Pressable style={styles.logoutButton} onPress={logout}>
              <MaterialIcons name="logout" size={18} color="#ff4d4f" />
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.loginContainer}>
      <Text style={styles.loginTitle}>Welcome to E-Buy</Text>
      <Text style={styles.loginSubtitle}>
        {authMode === 'login'
          ? 'Sign in to continue your shopping'
          : 'Create an account to get started'}
      </Text>

      <View style={styles.loginPanel}>
        {authMode === 'register' ? (
          <TextInput
            value={displayNameInput}
            onChangeText={setDisplayNameInput}
            autoCapitalize="words"
            placeholder="Display Name"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
        ) : null}

        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />

        <View style={styles.passwordInputWrapper}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!isPasswordVisible}
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            style={[styles.input, { flex: 1 }]}
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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.loginButton, isLoading && styles.buttonDisabled]} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>
            {isLoading
              ? 'Processing...'
              : authMode === 'login'
              ? 'Login'
              : 'Register'}
          </Text>
        </Pressable>

        <Pressable style={styles.googleButton} onPress={handleGoogleSignIn}>
          <MaterialIcons name="login" size={18} color="#4285F4" />
          <Text style={styles.googleButtonText}>Sign in with Google</Text>
        </Pressable>

        <View style={{ gap: 8 }}>
          <Pressable style={styles.switchAuthMode} onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
            <Text style={styles.switchAuthModeText}>
              {authMode === 'login' ? "Don't have an account? Register" : 'Already have an account? Login'}
            </Text>
          </Pressable>

          <Pressable style={styles.switchAuthMode} onPress={handleForgotPassword}>
            <Text style={[styles.switchAuthModeText, { color: '#64748b', fontSize: 12 }]}>Forgot Password?</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f7f3f3' },
  scrollContent: { paddingBottom: 96 },
  hero: {
    height: 296,
    paddingTop: 54,
    paddingHorizontal: 0,
    paddingBottom: 16,
    backgroundColor: '#FF6700',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  heroTopActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14 },
  heroIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,77,79,0.26)',
  },
  badgeDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6700' },
  profileCenterWrap: { marginTop: 18, alignItems: 'center', paddingHorizontal: 28 },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  nameRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 28, fontWeight: '800', color: '#ffffff', textTransform: 'capitalize' },
  actionPanel: { marginHorizontal: 16, marginTop: 12 },
  quickActionRow: { flexDirection: 'row', gap: 10 },
  quickActionButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffd3d3',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  quickActionLabel: { color: '#374151', fontSize: 12, fontWeight: '700' },
  groupCardTop: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#ffdede',
  },
  groupCardBottom: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#ffdede',
  },
  statusCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffdede',
    padding: 12,
    gap: 4,
  },
  statusText: { color: '#4b5563', fontSize: 13, fontWeight: '600' },
  rowButton: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { fontSize: 18, color: '#1f2430', fontWeight: '500' },
  separator: { height: 1, backgroundColor: '#eff0f3' },
  logoutWrap: { marginHorizontal: 16, marginTop: 14, marginBottom: 4 },
  logoutButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffbcbc',
    backgroundColor: '#fff5f5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  logoutText: { color: '#FF6700', fontWeight: '800', fontSize: 16 },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    gap: 10,
    backgroundColor: '#fdf2f2',
  },
  loginTitle: { fontSize: 30, fontWeight: '800', color: '#1f2430' },
  loginSubtitle: { color: '#7a6a6a', fontWeight: '500', marginBottom: 6 },
  loginPanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffdede',
    padding: 16,
    gap: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ffd3d3',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff8f8',
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '500',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  loginButton: { backgroundColor: '#ff4d4f', paddingVertical: 14, borderRadius: 12, alignItems: 'center', shadowColor: '#ff4d4f', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  buttonDisabled: { opacity: 0.7 },
  loginButtonText: { color: '#fff', fontWeight: '800' },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 12, borderRadius: 12, marginTop: 8, gap: 10 },
  googleButtonText: { color: '#374151', fontWeight: '700', fontSize: 15 },
  error: { color: '#b71c1c', fontWeight: '600' },
  switchAuthMode: { marginTop: 8, alignItems: 'center' },
  switchAuthModeText: { color: '#ff4d4f', fontWeight: '600', fontSize: 14 },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  passwordToggle: {
    position: 'absolute',
    right: 14,
  },
});
