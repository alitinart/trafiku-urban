import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Location from 'expo-location';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useFonts } from 'expo-font';
// import weights individually so only these five ship
import { HankenGrotesk_400Regular } from '@expo-google-fonts/hanken-grotesk/400Regular';
import { HankenGrotesk_500Medium } from '@expo-google-fonts/hanken-grotesk/500Medium';
import { HankenGrotesk_600SemiBold } from '@expo-google-fonts/hanken-grotesk/600SemiBold';
import { HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk/700Bold';
import { HankenGrotesk_800ExtraBold } from '@expo-google-fonts/hanken-grotesk/800ExtraBold';
import MapDom from './src/map/MapDom';
import Sheet, { type Snap, PEEK } from './src/ui/Sheet';
import { BusPanel, HomePanel, LinePanel, StationPanel } from './src/ui/panels';
import { IconClose, IconLocate, IconSearch, IconStop, LineBadge, PressScale } from './src/ui/primitives';
import { color, font, hit, motion, radius, shadow, space, type } from './src/ui/theme';
import { haversine, lines, stations } from './src/data/network';
import { fold, tidy } from './src/lib/format';
import { useNow } from './src/lib/useNow';
import type { Selection } from './src/state';

SplashScreen.preventAutoHideAsync().catch(() => {});

const CENTRE: [number, number] = [21.1625, 42.6605];
const searchIndex = stations.map((s) => ({ s, key: fold(s.name) }));

export default function App() {
  const [fontsLoaded] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
  });
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.map }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {fontsLoaded ? <Trafiku /> : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Trafiku() {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const insets = useSafeAreaInsets();
  const now = useNow(1000);

  const [stack, setStack] = useState<Selection[]>([null]);
  const selection = stack[stack.length - 1];
  const [snap, setSnap] = useState<Snap>('peek');
  const [sheetH, setSheetH] = useState(PEEK);
  const [follow, setFollow] = useState(false);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const go = useCallback((s: Selection) => {
    setStack((st) => {
      const top = st[st.length - 1];
      if (!s) return [null];
      if (top && top.kind === s.kind && top.id === s.id) return st;
      // shallow history: one entry per kind
      const base = st.filter((x) => !x || x.kind !== s.kind);
      return [...base, s].slice(-4);
    });
    setFollow(s?.kind === 'bus');
    setSnap((p) => (s ? (p === 'full' ? 'full' : 'half') : 'peek'));
    setQuery('');
    inputRef.current?.blur();
  }, []);
  const back = useCallback(() => {
    setStack((st) => (st.length > 1 ? st.slice(0, -1) : [null]));
    setFollow(false);
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  };

  const results = useMemo(() => {
    const q = fold(query);
    if (!q) return { lines: [], stations: [] };
    const lq = q.replace(/^(line|linja)\s*/, '');
    return {
      lines: lines.filter((l) => fold(l.id) === lq || (lq.length <= 2 && fold(l.id).startsWith(lq))).slice(0, 2),
      stations: searchIndex
        .filter((x) => q.split(/\s+/).every((w) => x.key.includes(w)))
        .sort((a, b) => Number(!a.key.startsWith(q)) - Number(!b.key.startsWith(q)))
        .slice(0, 6)
        .map((x) => x.s),
    };
  }, [query]);

  const nearest = (p: [number, number]) => {
    let best = stations[0];
    let bd = Infinity;
    for (const s of stations) {
      const d = haversine(p, [s.lon, s.lat]);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return { best, bd };
  };

  const locate = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('denied');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const me: [number, number] = [pos.coords.longitude, pos.coords.latitude];
      let { best, bd } = nearest(me);
      if (bd > 3000) {
        flash('You’re outside Prishtina, so here’s the stop closest to the centre.');
        best = nearest(CENTRE).best;
      }
      go({ kind: 'station', id: best.id });
    } catch {
      flash('Couldn’t get your location. Tap a stop on the map instead.');
    } finally {
      setLocating(false);
    }
  };

  const padding = desktop
    ? { top: 24, bottom: 24, left: 420, right: 24 }
    : { top: insets.top + 76, bottom: sheetH, left: 0, right: 0 };

  const panel = !selection ? (
    <HomePanel go={go} />
  ) : selection.kind === 'line' ? (
    <LinePanel id={selection.id} now={now} go={go} back={back} />
  ) : selection.kind === 'bus' ? (
    <BusPanel id={selection.id} now={now} go={go} back={back} follow={follow} setFollow={setFollow} />
  ) : (
    <StationPanel id={selection.id} now={now} go={go} back={back} />
  );
  const panelKey = selection ? `${selection.kind}:${selection.id}` : 'home';
  const showResults = focused && query.length > 0;

  // If the map hasn't drawn after 12 s (offline first visit, blocked tiles), say so.
  useEffect(() => {
    if (mapReady) return;
    const t = setTimeout(() => flash('The map is slow to load. Check your connection; buses and arrivals still work.'), 12000);
    return () => clearTimeout(t);
  }, [mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // FAB rides on top of the sheet
  const fabY = useSharedValue(0);
  useEffect(() => {
    fabY.value = withSpring(desktop ? 0 : -Math.min(sheetH, 560), motion.settle);
  }, [sheetH, desktop]); // eslint-disable-line react-hooks/exhaustive-deps
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ translateY: fabY.value }] }));

  // Native skeleton until the map has drawn (web uses the HTML boot skeleton)
  const veil = useSharedValue(1);
  useEffect(() => {
    if (mapReady) veil.value = withTiming(0, { duration: 320 });
  }, [mapReady]); // eslint-disable-line react-hooks/exhaustive-deps
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  return (
    <View style={styles.app}>
      <MapDom
        selection={selection}
        follow={follow}
        padding={padding}
        onPick={async (s) => go(s)}
        onUserPan={async () => setFollow(false)}
        onReady={async () => {
          setMapReady(true);
          if (Platform.OS === 'web') {
            const boot = document.getElementById('boot');
            boot?.classList.add('gone');
            setTimeout(() => boot?.remove(), 400);
          }
        }}
        dom={{
          style: { flex: 1 },
          scrollEnabled: false,
          bounces: false,
          overScrollMode: 'never',
          containerStyle: StyleSheet.absoluteFill,
        }}
      />
      {Platform.OS !== 'web' && !mapReady && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color.map }, veilStyle]} />
      )}

      {/* search */}
      <View
        style={[
          styles.topbar,
          desktop ? styles.topbarDesktop : { top: insets.top + space[3] },
          showResults && { borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet },
        ]}
      >
        <View style={styles.search}>
          <IconSearch />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search stops or lines"
            placeholderTextColor={color.ink3}
            selectionColor={color.ink}
            cursorColor={color.ink}
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            enterKeyHint="search"
            inputMode="search"
            accessibilityLabel="Search stops or lines"
            onSubmitEditing={() => {
              const l = results.lines[0];
              const s = results.stations[0];
              if (l) go({ kind: 'line', id: l.id });
              else if (s) go({ kind: 'station', id: s.id });
            }}
          />
          {query.length > 0 && (
            <PressScale onPress={() => setQuery('')} style={styles.iconBtn} scaleTo={0.88} accessibilityLabel="Clear search">
              <IconClose />
            </PressScale>
          )}
        </View>
        {showResults && (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.results}>
            {results.lines.map((l) => (
              <PressScale key={l.id} onPress={() => go({ kind: 'line', id: l.id })} style={styles.resultRow}>
                <LineBadge line={l} />
                <Text style={[type.md, { flex: 1 }]} numberOfLines={1}>
                  {l.termini.join(' – ')}
                </Text>
              </PressScale>
            ))}
            {results.stations.map((s) => (
              <PressScale key={s.id} onPress={() => go({ kind: 'station', id: s.id })} style={styles.resultRow}>
                <View style={styles.stopIcon}>
                  <IconStop />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={type.md} numberOfLines={1}>
                    {tidy(s.name)}
                  </Text>
                  <Text style={type.sm}>Lines {[...new Set(s.lines)].join(', ')}</Text>
                </View>
              </PressScale>
            ))}
            {results.lines.length + results.stations.length === 0 && (
              <Text style={[type.sm, { padding: space[3] }]}>No stop matches “{query}”. Try part of the name, like “Posta”.</Text>
            )}
          </Animated.View>
        )}
      </View>

      {/* nearest stop */}
      <Animated.View style={[styles.fabWrap, desktop ? { bottom: 40, right: 16 } : { bottom: space[3] }, fabStyle]}>
        <PressScale
          onPress={locate}
          style={styles.fab}
          scaleTo={0.9}
          accessibilityLabel="Show the stop nearest to me"
          accessibilityRole="button"
          disabled={locating}
        >
          <IconLocate color={locating ? color.ink3 : color.ink} />
        </PressScale>
      </Animated.View>

      <Sheet snap={snap} onSnap={setSnap} onHeight={setSheetH} desktop={desktop}>
        <Animated.View key={panelKey} entering={FadeIn.duration(180)}>
          {panel}
        </Animated.View>
      </Sheet>

      {toast && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(160)}
          style={[styles.toast, { top: insets.top + 76 }]}
          accessibilityLiveRegion="polite"
          pointerEvents="none"
        >
          <Text style={[type.sm, { color: color.onInk }]}>{toast}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: color.map, overflow: 'hidden' },
  topbar: {
    position: 'absolute',
    zIndex: 20, // results dropdown must sit above the sheet / side panel
    left: space[3],
    right: space[3],
    backgroundColor: color.surface,
    borderRadius: 26,
    ...shadow.e2,
  },
  topbarDesktop: { top: space[4], left: space[4], right: undefined, width: 380 },
  search: { flexDirection: 'row', alignItems: 'center', gap: space[2], height: 52, paddingLeft: space[4], paddingRight: space[1] },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontFamily: font.medium,
    fontSize: 16,
    color: color.ink,
    outlineStyle: 'none',
  } as object,
  iconBtn: { width: hit, height: hit, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  results: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, padding: space[2] },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 60, padding: space[2], borderRadius: radius.card },
  stopIcon: {
    width: 44,
    height: 40,
    borderRadius: radius.chip,
    backgroundColor: color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabWrap: { position: 'absolute', right: space[3] },
  fab: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.e2,
  },
  toast: {
    position: 'absolute',
    zIndex: 30,
    alignSelf: 'center',
    maxWidth: 420,
    marginHorizontal: space[4],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.card,
    backgroundColor: color.ink,
    ...shadow.e2,
  },
});
