import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      {/*
        Navigation hierarchy:
        1) Root Stack is the top-level navigator.
        2) `(tabs)` is the main shell (Home/Cart/Profile).
        3) `product/[id]` is pushed on top for drill-down details.
        4) `checkout` is presented as a modal for focused checkout flow.

        Why Stack here:
        - Stack is ideal for hierarchical transitions and overlay presentations.
      */}
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="checkout" options={{ presentation: 'modal', title: 'Checkout' }} />
        <Stack.Screen name="receipt" options={{ headerShown: false }} />
        <Stack.Screen name="profile/[section]" options={{ headerShown: false }} />
      </Stack>
      {/* <StatusBar style="auto" /> // StatusBar is typically handled in individual screens or a global component */}
    </ThemeProvider>
  );
}
