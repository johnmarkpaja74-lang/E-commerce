/**
 * Below are the colors that are used in the app. The colors are defined for a single theme.
 */

import { Platform } from 'react-native';

const primaryBlaze = '#FF6700';

export const Colors = {
  primary: primaryBlaze, // Main brand color (Blaze Orange)
  accent: primaryBlaze, // Accent color, often same as primary for consistency (Blaze Orange)
  text: '#11181C', // Dark text for light backgrounds (Near black)
  textSecondary: '#687076', // Lighter text for secondary info (Gray)
  background: '#f5f5f6', // Light background for general screens (Off-white)
  surface: '#ffffff', // White background for cards, modals, etc. (Pure white)
  border: '#e5e7eb', // Light border color (Light gray)
  tint: primaryBlaze, // Tint color for icons/active states (Blaze Orange)
  icon: '#687076', // Default icon color (Gray)
  tabIconDefault: '#687076', // Default tab icon color (Gray)
  tabIconSelected: primaryBlaze, // Selected tab icon color (Blaze Orange)
  card: '#ffffff', // Card background color (Pure white)
  error: primaryBlaze, // Error message color (Blaze Orange)
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
