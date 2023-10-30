import { StyleSheet, Text, View } from "react-native";
import UiModal from "../components/ui/UiModal";
import Map from "../components/ui/home/Map";
import { useState } from "react";

export default function Home() {
  const [visibe, setVisible] = useState(false);

  function onStationPress() {
    setVisible(true);
  }

  return (
    <View style={styles.container}>
      <Map onMarkerPress={onStationPress} />
      <UiModal
        visible={visibe}
        onClose={() => {
          setVisible(false);
        }}
      />
    </View>
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
