import { LatLng, Region } from "react-native-maps";

const URBAN_MAX_SPEED_LIMIT = 30;

export default function computeDistance(
  firstRegion: LatLng | Region,
  secondRegion: LatLng | Region
) {
  const firstLat = toRad(firstRegion.latitude);
  const firstLon = toRad(firstRegion.longitude);
  const secondLat = toRad(secondRegion.latitude);
  const secondLon = toRad(secondRegion.longitude);

  return (
    6377.830272 *
    Math.acos(
      Math.sin(firstLat) * Math.sin(secondLat) +
        Math.cos(firstLat) *
          Math.cos(secondLat) *
          Math.cos(secondLon - firstLon)
    )
  );
}

function toRad(angle: number) {
  return (angle * Math.PI) / 180;
}

export function computeDistanceInMinutes(
  firstRegion: LatLng | Region,
  secondRegion: LatLng | Region
) {
  const distanceInKilometers = computeDistance(firstRegion, secondRegion);
  return Math.round((distanceInKilometers / URBAN_MAX_SPEED_LIMIT) * 60);
}
