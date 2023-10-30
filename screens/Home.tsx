import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView from "react-native-maps";
import * as Location from "expo-location";

export default function Home() {
  const [location, setLocation] = useState<Location.LocationObject>();

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("We need permissions for this app");
        return;
      }

      let loc = await Location.getCurrentPositionAsync();
      setLocation(loc);
    })();
  }, []);

  return location ? (
    <View style={styles.container}>
      <MapView
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          longitudeDelta: 0.01,
          latitudeDelta: 0.01,
        }}
        style={styles.map}
      ></MapView>
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
