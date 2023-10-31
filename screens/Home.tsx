import { StyleSheet, Text, View } from "react-native";
import StationModal from "../components/ui/home/StationModal";
import Map from "../components/ui/home/Map";
import { useState } from "react";
import { useSelector } from "react-redux";
import State from "../models/State";

export default function Home() {
  const [visibe, setVisible] = useState(false);
  const currentStation = useSelector((state: State) => state.selectedStation);

  function onStationPress() {
    setVisible(true);
  }

  return (
    <View style={styles.container}>
      <Map onMarkerPress={onStationPress} />
      <StationModal
        visible={visibe}
        title={currentStation.title}
        text={currentStation.description}
        onClose={() => {
          setVisible(false);
        }}
        data={currentStation.busesComing}
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
