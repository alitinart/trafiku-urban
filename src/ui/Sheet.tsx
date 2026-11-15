import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, motion, radius, shadow, space } from './theme';

export type Snap = 'peek' | 'half' | 'full';
export const PEEK = 204;

interface Props {
  snap: Snap;
  onSnap(s: Snap): void;
  onHeight(px: number): void;
  desktop: boolean;
  children: ReactNode;
}

/**
 * Bottom sheet with three poses (peek / half / full). Drag the grabber area;
 * on release we project the fling velocity and spring to the nearest pose.
 * On wide screens it becomes a floating side panel.
 */
export default function Sheet({ snap, onSnap, onHeight, desktop, children }: Props) {
  const { height: vh } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const H = { peek: PEEK + insets.bottom, half: Math.round(Math.min(vh * 0.56, 560)), full: vh - insets.top - 76 };

  const h = useSharedValue(H[snap]);
  const startH = useSharedValue(H[snap]);
  const dragging = useSharedValue(0);

  useEffect(() => {
    h.value = withSpring(H[snap], motion.settle);
    onHeight(Math.min(H[snap], H.half));
  }, [snap, H.peek, H.half, H.full]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = usePanGesture({
    activeOffsetY: [-4, 4],
    onActivate: () => {
      'worklet';
      startH.value = h.value;
      dragging.value = withSpring(1, motion.snap);
    },
    onUpdate: (e) => {
      'worklet';
      let next = startH.value - e.translationY;
      if (next > H.full) next = H.full + (next - H.full) * 0.25; // rubber-band
      if (next < H.peek) next = H.peek - (H.peek - next) * 0.35;
      h.value = next;
    },
    onDeactivate: (e) => {
      'worklet';
      dragging.value = withSpring(0, motion.snap);
      const projected = h.value - e.velocityY * 0.18;
      const poses: Snap[] = ['peek', 'half', 'full'];
      let best: Snap = 'peek';
      let bd = 1e9;
      for (const p of poses) {
        const d = Math.abs(H[p] - projected);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      h.value = withSpring(H[best], { ...motion.settle, velocity: -e.velocityY });
      scheduleOnRN(onSnap, best);
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ height: h.value }));
  const grabStyle = useAnimatedStyle(() => ({
    width: interpolate(dragging.value, [0, 1], [40, 54]),
    backgroundColor: dragging.value > 0.5 ? color.ink3 : color.surface3,
  }));

  if (desktop) {
    return (
      <View style={styles.panel}>
        <ScrollView contentContainerStyle={{ padding: space[2], paddingBottom: space[4] }} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.sheet, sheetStyle]}>
      <GestureDetector gesture={pan}>
        <Pressable
          style={styles.grabZone}
          onPress={() => onSnap(snap === 'peek' ? 'half' : 'peek')}
          accessibilityRole="adjustable"
          accessibilityLabel="Resize details panel"
        >
          <Animated.View style={[styles.grabber, grabStyle]} />
        </Pressable>
      </GestureDetector>
      <ScrollView
        scrollEnabled={snap !== 'peek'}
        contentContainerStyle={{ paddingHorizontal: space[2], paddingBottom: insets.bottom + space[4] }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
    ...shadow.e3,
  },
  grabZone: { height: 32, alignItems: 'center', justifyContent: 'center', cursor: 'grab' } as object,
  grabber: { height: 5, borderRadius: 3 },
  panel: {
    position: 'absolute',
    top: 16 + 52 + 12,
    left: 16,
    width: 380,
    maxHeight: '86%',
    backgroundColor: color.surface,
    borderRadius: radius.sheet,
    overflow: 'hidden',
    ...shadow.e2,
  },
});
