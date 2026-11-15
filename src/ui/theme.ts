// Trafiku design system tokens.
// One type family, one accent, a 4pt spacing grid, nested radii (inner = outer − padding),
// and three motion presets.
import { Platform, type TextStyle } from 'react-native';

export const color = {
  map: '#ECEEEA',
  surface: '#FFFFFF',
  surface2: '#F4F5F2',
  surface3: '#E9EBE7',
  hairline: '#E3E5E1',
  ink: '#15171A', // 17:1 on surface
  ink2: '#464B53', // 8.9:1
  ink3: '#636973', // 5.1:1
  onInk: '#F4F5F1',
  accent: '#B8F23A', // "live" + primary action only
  accentInk: '#1D2A05',
  live: '#4AA31A',
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;

export const radius = {
  sheet: 24,
  card: 16, // sheet 24 − 8 inset
  chip: 8, // card 16 − 8 padding
  pill: 999,
} as const;

export const hit = 48;

export const font = {
  regular: 'HankenGrotesk_400Regular',
  medium: 'HankenGrotesk_500Medium',
  semibold: 'HankenGrotesk_600SemiBold',
  bold: 'HankenGrotesk_700Bold',
  heavy: 'HankenGrotesk_800ExtraBold',
} as const;

const tnum: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = {
  xl: { fontFamily: font.bold, fontSize: 28, lineHeight: 31, letterSpacing: -0.6, color: color.ink },
  lg: { fontFamily: font.bold, fontSize: 20, lineHeight: 24, letterSpacing: -0.2, color: color.ink },
  md: { fontFamily: font.semibold, fontSize: 16, lineHeight: 20, color: color.ink },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 22, color: color.ink },
  sm: { fontFamily: font.medium, fontSize: 14, lineHeight: 18, color: color.ink2 },
  xs: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, color: color.ink3 },
  tnum,
} satisfies Record<string, TextStyle>;

export const shadow = {
  e2: Platform.select({
    web: { boxShadow: '0 1px 2px rgba(21,23,26,.06), 0 8px 24px rgba(21,23,26,.10)' },
    default: { shadowColor: '#15171A', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  }) as object,
  e3: Platform.select({
    web: { boxShadow: '0 -1px 0 rgba(21,23,26,.04), 0 -12px 32px rgba(21,23,26,.12)' },
    default: { shadowColor: '#15171A', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 12 },
  }) as object,
};

/** Motion presets (Reanimated springs). */
export const motion = {
  // lands with a touch of overshoot: follow-through
  settle: { damping: 20, stiffness: 210, mass: 0.9 },
  // snappy UI feedback
  snap: { damping: 18, stiffness: 420, mass: 0.6 },
  // press wind-up / release
  press: { damping: 15, stiffness: 520, mass: 0.5 },
} as const;
