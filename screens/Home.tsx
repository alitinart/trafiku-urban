import { lazy, useEffect, useRef, useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";
import * as Location from "expo-location";

const busMarker = require("../assets/images/bus_stacion_marker.png");

interface Station {
  title: string;
  location: Region;
  description: string;
}

export default function Home() {
  const [location, setLocation] = useState<Location.LocationObject>();
  const [region, setRegion] = useState<Region>();

  const mapRef = useRef<MapView>(null);

  // Would be fetched from backend...
  const busStations: Station[] = [
    {
      title: "Stacioni Termokos",
      location: {
        latitude: 42.6528319,
        longitude: 21.1744671,
        latitudeDelta: 0.001,
        longitudeDelta: 0.001,
      },
      description: "Nenstactioni i Termokosit",
    },
  ];

  function zoomInMarker(location: Region) {
    if (mapRef.current == null) {
      return;
    }
    mapRef.current.animateToRegion(location);
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
          onPress={() => zoomInMarker(staction.location)}
        >
          {Platform.OS == "ios" && (
            <Image source={busMarker} style={{ width: 30, height: 30 }} />
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
      setLocation(loc);
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        longitudeDelta: 0.01,
        latitudeDelta: 0.01,
      });
    })();
  }, []);

  return location ? (
    <View style={styles.container}>
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
      </MapView>
    </View>
  ) : (
    <Text>No Location permissions were given</Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
});
