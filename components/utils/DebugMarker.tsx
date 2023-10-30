import { useState } from "react";
import { LatLng, Marker, MarkerDragStartEndEvent } from "react-native-maps";

interface Props {
  intialRegion: LatLng;
}

export default function DebugMarker({ intialRegion }: Props) {
  const [location, setLocation] = useState(intialRegion);

  function handleDrag(e: MarkerDragStartEndEvent) {
    const coords = e.nativeEvent.coordinate;
    console.log(coords);
    setLocation(coords);
  }

  return (
    <Marker coordinate={location} draggable onDragEnd={(e) => handleDrag(e)} />
  );
}
