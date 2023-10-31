import { useState } from "react";
import { LatLng, Marker, MarkerDragStartEndEvent } from "react-native-maps";
import { busStations } from "../../data/stations";
import computeDistance from "../../service/computeDistance";

interface Props {
  intialRegion: LatLng;
}

export default function DebugMarker({ intialRegion }: Props) {
  const [location, setLocation] = useState(intialRegion);

  function handleDrag(e: MarkerDragStartEndEvent) {
    const coords = e.nativeEvent.coordinate;
    console.log(coords);
    console.log(computeDistance(coords, busStations[0].location));
    setLocation(coords);
  }

  return (
    <Marker coordinate={location} draggable onDragEnd={(e) => handleDrag(e)} />
  );
}
