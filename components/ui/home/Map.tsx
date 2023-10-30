import { useEffect, useRef, useState } from "react";
import { Image, Platform, StyleSheet, Text } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";

const busMarker = require("../../../assets/images/bus_stacion_marker.png");

import * as Location from "expo-location";
import DebugMarker from "../../utils/DebugMarker";

import { useDispatch } from "react-redux";
import { setSelectedStation } from "../../../store/reducers/root.reducer";
import Bus from "../../../models/Bus";

export interface Station {
  title: string;
  location: Region;
  description: string;
  busesComing: { bus: Bus; timeLeft: number }[];
}

interface Props {
  onMarkerPress: () => any;
}

const MARKER_DISPOSITION = 0.00018054408406;

export default function Map({ onMarkerPress }: Props) {
  const [region, setRegion] = useState<Region>();
  const mapRef = useRef<MapView>(null);

  const dispatch = useDispatch();

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
      busesComing: [
        {
          bus: {
            type: "3",
          },
          timeLeft: 12,
        },
      ],
    },
    {
      title: "Stacioni Maxi 24h",
      location: {
        latitude: 42.65223067684647,
        longitude: 21.176215186715122,
        latitudeDelta: 0.001,
        longitudeDelta: 0.001,
      },
      description: "Stacioni te Maxi 24h",
      busesComing: [
        {
          bus: {
            type: "3C",
          },
          timeLeft: 12,
        },
      ],
    },
  ];

  function handleMarkerPress(station: Station) {
    if (mapRef.current == null) {
      return;
    }
    mapRef.current.animateToRegion({
      ...station.location,
      latitude: station.location.latitude - MARKER_DISPOSITION,
    });

    dispatch(setSelectedStation(station));
    onMarkerPress();
  }

  function showStactionMarkers() {
    return busStations.map((station, index) => {
      return (
        <Marker
          key={index}
          identifier={index.toString()}
          coordinate={station.location}
          title={station.title}
          description={station.description}
          image={Platform.OS == "android" && busMarker}
          style={{ width: 40, height: 40 }}
          onPress={() => handleMarkerPress(station)}
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
