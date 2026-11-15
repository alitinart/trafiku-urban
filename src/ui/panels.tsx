import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { lineById, lineFamilies, lines, stationById } from '../data/network';
import { arrivalsAt, buses, busById, busState, etaToStop, timetables, upcomingStops } from '../sim/simulation';
import { clock, tidy } from '../lib/format';
import type { Selection } from '../state';
import { Eta, IconBack, IconChevron, IconClose, IconFollow, LineBadge, LiveDot, PressScale } from './primitives';
import { color, font, hit, radius, space, type } from './theme';

type Go = (s: Selection) => void;

const enter = (i: number) => FadeInDown.delay(Math.min(i, 10) * 28).duration(220).springify().damping(22).stiffness(260);

function Header({ onBack, onClose, children }: { onBack?: () => void; onClose?: () => void; children: ReactNode }) {
  return (
    <View style={s.head}>
      {onBack && (
        <PressScale onPress={onBack} style={s.iconBtn} scaleTo={0.88} accessibilityLabel="Back" accessibilityRole="button">
          <IconBack />
        </PressScale>
      )}
      <View style={s.headMain}>{children}</View>
      {onClose && (
        <PressScale onPress={onClose} style={s.iconBtn} scaleTo={0.88} accessibilityLabel="Close" accessibilityRole="button">
          <IconClose />
        </PressScale>
      )}
    </View>
  );
}

function Row({
  i,
  onPress,
  children,
  first,
  label,
}: {
  i: number;
  onPress(): void;
  children: ReactNode;
  first?: boolean;
  label: string;
}) {
  return (
    <Animated.View entering={enter(i)}>
      <PressScale onPress={onPress} style={[s.row, first && s.rowFirst]} accessibilityRole="button" accessibilityLabel={label}>
        {children}
      </PressScale>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- home
export function HomePanel({ go }: { go: Go }) {
  return (
    <View style={s.p}>
      <View style={s.intro}>
        <View style={s.headline}>
          <LiveDot />
          <Text style={[type.xl, { flex: 1 }]} accessibilityRole="header">
            {buses.length} buses on {lines.length} lines
          </Text>
        </View>
        <Text style={type.sm}>Tap a bus for its route, or a stop for arrival times.</Text>
      </View>
      {lineFamilies.map((fam, fi) => (
        <View key={fam[0].family} style={fi > 0 && s.family}>
          {fam.map((l, j) => {
            const n = buses.filter((b) => b.line === l.id).length;
            const every = Math.round(timetables.get(l.id)!.lap / n / 60);
            return (
              <Row key={l.id} i={fi + j} onPress={() => go({ kind: 'line', id: l.id })} label={`Line ${l.id}, ${l.termini.join(' to ')}`}>
                <LineBadge line={l} />
                <View style={s.rowMain}>
                  <Text style={type.md} numberOfLines={2}>
                    {l.termini.join(' – ')}
                  </Text>
                  <Text style={[type.sm, type.tnum]} numberOfLines={1}>
                    {n} buses · every {every} min · {(l.length / 1000).toFixed(1)} km
                  </Text>
                </View>
                <IconChevron />
              </Row>
            );
          })}
        </View>
      ))}
      <Text style={[type.xs, s.fine]}>
        Routes and stops come from OpenStreetMap. Bus positions are simulated from a timetable, not a live GPS feed.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------- line
export function LinePanel({ id, now, go, back }: { id: string; now: number; go: Go; back: () => void }) {
  const l = lineById.get(id)!;
  const fleet = buses
    .filter((b) => b.line === id)
    .map((b) => {
      const st = busState(b, now);
      return { b, st, eta: etaToStop(b, st.nextStop, now, st) };
    })
    .sort((a, b) => a.st.headsign.localeCompare(b.st.headsign) || a.eta - b.eta);
  const every = Math.round(timetables.get(id)!.lap / fleet.length / 60);
  return (
    <View style={s.p}>
      <Header onBack={back}>
        <View style={s.titleRow}>
          <LineBadge line={l} size="lg" />
          <View style={{ flex: 1 }}>
            <Text style={type.lg} accessibilityRole="header">
              {l.termini.join(' – ')}
            </Text>
            <Text style={[type.sm, type.tnum, { marginTop: 2 }]}>
              {l.stops.length} stops · every {every} min · {(l.length / 1000).toFixed(1)} km
            </Text>
          </View>
        </View>
      </Header>
      <Text style={s.section}>On the road now</Text>
      {fleet.map(({ b, st, eta }, i) => {
        const next = stationById.get(l.stops[st.nextStop].station)!;
        return (
          <Row key={b.id} i={i} onPress={() => go({ kind: 'bus', id: b.id })} label={`Bus ${b.fleet} to ${st.headsign}`}>
            <View style={s.rowMain}>
              <Text style={type.md} numberOfLines={1}>
                To {tidy(st.headsign)}
              </Text>
              <Text style={type.sm} numberOfLines={1}>
                {st.dwelling ? 'At' : 'Next'}: {tidy(next.name)}
              </Text>
            </View>
            <Eta sec={eta} quiet />
          </Row>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- bus
export function BusPanel({
  id,
  now,
  go,
  back,
  follow,
  setFollow,
}: {
  id: string;
  now: number;
  go: Go;
  back: () => void;
  follow: boolean;
  setFollow(f: boolean): void;
}) {
  const b = busById.get(id)!;
  const l = lineById.get(b.line)!;
  const st = busState(b, now);
  const next = upcomingStops(b, now, 7);
  return (
    <View style={s.p}>
      <Header onBack={back}>
        <View style={s.titleRow}>
          <LineBadge line={l} size="lg" />
          <View style={{ flex: 1 }}>
            <Text style={type.lg} accessibilityRole="header">
              To {tidy(st.headsign)}
            </Text>
            <Text style={[type.sm, type.tnum, { marginTop: 2 }]}>
              Bus {b.fleet} · {st.dwelling ? 'boarding' : `${Math.round(st.speed * 3.6)} km/h`}
            </Text>
          </View>
        </View>
      </Header>
      <PressScale
        onPress={() => setFollow(!follow)}
        style={[s.cta, follow && s.ctaOn]}
        accessibilityRole="switch"
        accessibilityState={{ checked: follow }}
      >
        <IconFollow color={follow ? color.accentInk : color.accent} />
        <Text style={[s.ctaText, follow && { color: color.accentInk }]}>{follow ? 'Following this bus' : 'Follow this bus'}</Text>
      </PressScale>
      <Text style={s.section}>Next stops</Text>
      {next.map((x, i) => {
        const station = stationById.get(x.station)!;
        const isNext = i === 0;
        return (
          <Animated.View key={x.si} entering={enter(i)}>
            <PressScale
              onPress={() => go({ kind: 'station', id: x.station })}
              style={s.tlRow}
              accessibilityRole="button"
              accessibilityLabel={`${station.name}, ${Math.round(x.eta / 60)} minutes`}
            >
              <View style={s.tlRail}>
                <View
                  style={[
                    s.tlLine,
                    { backgroundColor: l.color },
                    i === 0 && { top: '50%' },
                    i === next.length - 1 && { bottom: '50%', opacity: 0.4 },
                  ]}
                />
                <View
                  style={
                    isNext
                      ? [s.tlDotNext, { backgroundColor: l.color, borderColor: color.surface, outlineColor: l.color } as object]
                      : [s.tlDot, { borderColor: l.color }]
                  }
                />
              </View>
              <View style={s.rowMain}>
                <Text style={[type.md, isNext && { fontFamily: font.bold }]} numberOfLines={2}>
                  {tidy(station.name)}
                </Text>
                {isNext && <Text style={type.sm}>{x.eta === 0 ? 'At the stop now' : 'Next stop'}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Eta sec={x.eta} />
                <Text style={[type.xs, type.tnum]}>{clock(now + x.eta)}</Text>
              </View>
            </PressScale>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- station
export function StationPanel({ id, now, go, back }: { id: string; now: number; go: Go; back: () => void }) {
  const st = stationById.get(id)!;
  const arrivals = arrivalsAt(id, now, 6);
  const served = [...new Set(st.lines)].map((x) => lineById.get(x)!);
  return (
    <View style={s.p}>
      <Header onClose={back}>
        <Text style={type.lg} accessibilityRole="header">
          {tidy(st.name)}
        </Text>
        <View style={s.chips}>
          {served.map((l) => (
            <PressScale key={l.id} onPress={() => go({ kind: 'line', id: l.id })} scaleTo={0.9} style={s.chip} accessibilityRole="button">
              <LineBadge line={l} size="sm" />
            </PressScale>
          ))}
        </View>
      </Header>
      <Text style={s.section}>Arriving</Text>
      {arrivals.length === 0 ? (
        <Text style={[type.sm, { padding: space[2] }]}>No buses due in the next 45 minutes.</Text>
      ) : (
        arrivals.map((a, i) => (
          <Row
            key={`${a.bus.id}-${i}`}
            i={i}
            first={i === 0}
            onPress={() => go({ kind: 'bus', id: a.bus.id })}
            label={`Line ${a.line.id} to ${a.headsign}, ${Math.round(a.eta / 60)} minutes`}
          >
            <LineBadge line={a.line} />
            <View style={s.rowMain}>
              <Text style={type.md} numberOfLines={1}>
                To {tidy(a.headsign)}
              </Text>
              <Text style={[type.sm, type.tnum]} numberOfLines={1}>
                Bus {a.bus.fleet} · {clock(now + a.eta)}
              </Text>
            </View>
            <Eta sec={a.eta} big={i === 0} />
          </Row>
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  p: { paddingHorizontal: space[2] },
  intro: { paddingHorizontal: space[2], paddingTop: space[1], paddingBottom: space[4], gap: space[2] },
  headline: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  family: { marginTop: space[3], paddingTop: space[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  fine: { paddingHorizontal: space[2], paddingTop: space[4], lineHeight: 18 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space[1], paddingBottom: space[3] },
  headMain: { flex: 1, minWidth: 0, paddingTop: space[1], paddingHorizontal: space[2] },
  iconBtn: { width: hit, height: hit, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1], marginTop: space[3] },
  chip: { borderRadius: radius.chip, padding: 2 },
  section: { ...type.sm, fontFamily: font.semibold, paddingHorizontal: space[2], paddingTop: space[2], paddingBottom: space[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 64,
    paddingVertical: space[3],
    paddingHorizontal: space[2],
    borderRadius: radius.card,
  },
  rowFirst: { backgroundColor: color.surface2 },
  rowMain: { flex: 1, minWidth: 0, gap: 2 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    height: 52,
    marginTop: space[1],
    marginBottom: space[5],
    borderRadius: radius.card,
    backgroundColor: color.ink,
  },
  ctaOn: { backgroundColor: color.accent },
  ctaText: { fontFamily: font.bold, fontSize: 16, color: color.onInk },
  tlRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, paddingRight: space[2], borderRadius: radius.card },
  tlRail: { width: 36, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  tlLine: { position: 'absolute', top: -1, bottom: -1, width: 4, left: 16 },
  tlDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, backgroundColor: color.surface },
  tlDotNext: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, outlineWidth: 2, outlineStyle: 'solid' },
});
