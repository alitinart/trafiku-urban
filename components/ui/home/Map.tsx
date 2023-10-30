import { useEffect, useRef, useState } from "react";
import { Image, Platform, StyleSheet, Text } from "react-native";
import MapView, {
  Marker,
  MarkerDragStartEndEvent,
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps";

const busMarker = require("../../../assets/images/bus_stacion_marker.png");

import * as Location from "expo-location";
import DebugMarker from "../../utils/DebugMarker";

interface Station {
  title: string;
  location: Region;
  description: string;
}

interface Props {
  onMarkerPress: () => any;
}

const MARKER_DISPOSITION = 0.00018054408406;

export default function Map({ onMarkerPress }: Props) {
  const [region, setRegion] = useState<Region>();

  const mapRef = useRef<MapView>(null);
  //0,00034526450619
  // Would be fetched from backend...
  const busStations: Station[] = [
    {
      title: "Stacioni Termokos",
      location: {
        latitude: 42.6528319,
        longitude: 21.174467,
        latitudeDelta: 0.001,
        longitudeDelta: 0.001,
      },
      description: "Nenstactioni i Termokosit",
    },
  ];
  42.65265135591594;
  function handleMarkerPress(location: Region) {
    if (mapRef.current == null) {
      return;
    }
    mapRef.current.animateToRegion({
      ...location,
      latitude: location.latitude - MARKER_DISPOSITION,
    });

    onMarkerPress();
  }

  function showStactionMarkers() {
    return busStations.map((staction, index) => {
      return (
        <Marker
          key={index}
          identifier={index.toString()}
          coordinate={staction.location}
          title={staction.title}
          description={staction.description}
          image={Platform.OS == "android" && busMarker}
          style={{ width: 40, height: 40 }}
          onPress={() => handleMarkerPress(staction.location)}
        >
          {Platform.OS == "ios" && (
            <Image source={busMarker} style={{ width: 40, height: 40 }} />
          )}
        </Marker>
      );
    });
  }

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("We need permissions for this app");
        return;
      }

      let loc = await Location.getCurrentPositionAsync();
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        longitudeDelta: 0.01,
        latitudeDelta: 0.01,
      });
    })();
  }, []);

  return region ? (
    <MapView
      provider={PROVIDER_GOOGLE}
      ref={mapRef}
      initialRegion={region}
      region={region}
      zoomEnabled={true}
      showsUserLocation={true}
      style={styles.map}
    >
      {showStactionMarkers()}
      <DebugMarker intialRegion={region} />
    </MapView>
  ) : (
    <Text>Loading Map</Text>
  );
}

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: "100%",
  },
});
