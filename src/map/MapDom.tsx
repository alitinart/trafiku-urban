'use dom';
// The 3D map runs as an Expo DOM component: inline on web, inside a native
// WebView on iOS/Android. Same MapLibre + three.js code on every platform.
import 'maplibre-gl/dist/maplibre-gl.css';
import './map.css';
import MapView, { type Pad } from './MapView';
import type { Selection } from '../state';

interface Props {
  selection: Selection;
  follow: boolean;
  padding: Pad;
  onPick: (sel: Selection) => Promise<void>;
  onUserPan: () => Promise<void>;
  onReady: () => Promise<void>;
  dom?: import('expo/dom').DOMProps;
}

export default function MapDom({ selection, follow, padding, onPick, onUserPan, onReady }: Props) {
  return (
    <MapView
      selection={selection}
      follow={follow}
      padding={padding}
      onPick={(s) => void onPick(s)}
      onUserPan={() => void onUserPan()}
      onReady={() => void onReady()}
    />
  );
}
