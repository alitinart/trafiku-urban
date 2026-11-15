import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { Line } from '../data/network';
import { etaParts } from '../lib/format';
import { color, font, motion, radius, type } from './theme';

// ------------------------------------------------------------ PressScale
/** Pressable with a wind-up on press-in and a springy release (anticipation + follow-through). */
export function PressScale({
  children,
  style,
  scaleTo = 0.97,
  ...rest
}: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        s.value = withSpring(scaleTo, motion.press);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, motion.press);
        rest.onPressOut?.(e);
      }}
    >
      {({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => (
        <Animated.View style={[(hovered || pressed) && styles.hover, style, a]}>{children}</Animated.View>
      )}
    </Pressable>
  );
}

// ------------------------------------------------------------ LineBadge
const BADGE = {
  sm: { minWidth: 32, height: 28, fontSize: 14, r: 7, px: 6 },
  md: { minWidth: 44, height: 40, fontSize: 16, r: radius.chip, px: 8 },
  lg: { minWidth: 56, height: 52, fontSize: 20, r: 12, px: 10 },
};
export function LineBadge({ line, size = 'md' }: { line: Line; size?: keyof typeof BADGE }) {
  const b = BADGE[size];
  return (
    <View
      style={{
        minWidth: b.minWidth,
        height: b.height,
        paddingHorizontal: b.px,
        borderRadius: b.r,
        backgroundColor: line.color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityLabel={`Line ${line.id}`}
    >
      <Text style={[{ fontFamily: font.heavy, fontSize: b.fontSize, color: line.ink, letterSpacing: -0.2 }, type.tnum]}>
        {line.id}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------ Eta
export function Eta({ sec, big, quiet }: { sec: number; big?: boolean; quiet?: boolean }) {
  const e = quiet && sec < 45 ? { value: '<1', unit: 'min', due: false } : etaParts(sec);
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = e.due
      ? withRepeat(withSequence(withTiming(1.07, { duration: 650, easing: Easing.inOut(Easing.cubic) }), withTiming(1, { duration: 650 })), -1)
      : withTiming(1, { duration: 120 });
  }, [e.due]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  if (e.due) {
    return (
      <Animated.View style={[styles.due, a]}>
        <Text style={styles.dueText}>Due</Text>
      </Animated.View>
    );
  }
  return (
    <View style={styles.eta}>
      <Text style={[styles.etaV, big && { fontSize: 28, lineHeight: 30 }, type.tnum]}>{e.value}</Text>
      <Text style={styles.etaU}>{e.unit}</Text>
    </View>
  );
}

// ------------------------------------------------------------ LiveDot
export function LiveDot() {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }), -1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ring = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - r.value), transform: [{ scale: 1 + r.value * 1.8 }] }));
  return (
    <View style={{ width: 8, height: 8 }}>
      <Animated.View style={[styles.dot, ring]} />
      <View style={styles.dot} />
    </View>
  );
}

// ------------------------------------------------------------ Icons (one family: 24 grid, 1.75 stroke, round)
type IconProps = { size?: number; color?: string };
const stroke = (c?: string) => ({
  stroke: c ?? color.ink2,
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
});
export const IconSearch = ({ size = 20, color: c }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={11} cy={11} r={6.5} {...stroke(c)} />
    <Path d="m20 20-4.2-4.2" {...stroke(c)} />
  </Svg>
);
export const IconClose = ({ size = 20, color: c }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 6l12 12M18 6 6 18" {...stroke(c)} />
  </Svg>
);
export const IconBack = ({ size = 20, color: c }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M15 5l-7 7 7 7" {...stroke(c)} />
  </Svg>
);
export const IconChevron = ({ size = 18, color: c }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="m9 5 7 7-7 7" {...stroke(c ?? color.ink3)} />
  </Svg>
);
export const IconLocate = ({ size = 20, color: c }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={7} {...stroke(c ?? color.ink)} />
    <Circle cx={12} cy={12} r={2.5} fill={c ?? color.ink} />
    <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" {...stroke(c ?? color.ink)} />
  </Svg>
);
export const IconFollow = ({ size = 20, color: c }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 3 19.5 20 12 16 4.5 20 12 3Z" {...stroke(c)} />
  </Svg>
);
export const IconStop = ({ size = 20, color: c }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x={6} y={3} width={12} height={13} rx={3} {...stroke(c)} />
    <Path d="M6 11h12M9 19.5l-1 1.5M15 19.5l1 1.5M9 7.5h6" {...stroke(c)} />
  </Svg>
);

const styles = StyleSheet.create({
  hover: { backgroundColor: color.surface2 },
  eta: { flexDirection: 'row', alignItems: 'baseline', gap: 3, minWidth: 44, justifyContent: 'flex-end' },
  etaV: { fontFamily: font.bold, fontSize: 20, lineHeight: 24, letterSpacing: -0.4, color: color.ink },
  etaU: { fontFamily: font.semibold, fontSize: 12, color: color.ink2 },
  due: { backgroundColor: color.accent, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  dueText: { fontFamily: font.bold, fontSize: 15, color: color.accentInk },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: color.live },
});
