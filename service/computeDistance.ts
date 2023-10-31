import { LatLng, Region } from "react-native-maps";

const URBAN_MAX_SPEED_LIMIT = 30;

export default function computeDistance(
  firstRegion: LatLng | Region,
  secondRegion: LatLng | Region
) {
  const earthRadius = 6371;

  const lat1Rad = toRad(firstRegion.latitude);
  const lon1Rad = toRad(firstRegion.longitude);
  const lat2Rad = toRad(secondRegion.latitude);
  const lon2Rad = toRad(secondRegion.longitude);

  const dLat = lat2Rad - lat1Rad;
  const dLon = lon2Rad - lon1Rad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Calculate the distance
  const distance = earthRadius * c;

  return distance;
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
