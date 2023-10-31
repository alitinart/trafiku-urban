import { StyleSheet, Text, View } from "react-native";
import Bus, { returnBusColor } from "../../../models/Bus";
import computeDistance, {
  computeDistanceInMinutes,
} from "../../../service/computeDistance";
import { useSelector } from "react-redux";
import State from "../../../models/State";
interface Props {
  bus: Bus;
}

export default function BusStatus({ bus }: Props) {
  const selectedStation = useSelector((state: State) => state.selectedStation);

  return (
    <View
      style={[
        styles.busStatusContainer,
        { backgroundColor: returnBusColor(bus.type) },
      ]}
    >
      <View>
        <Text style={styles.busType}>{bus.type}</Text>
      </View>
      <View>
        <Text style={styles.time}>
          {computeDistanceInMinutes(
            {
              latitude: selectedStation.location.latitude,
              longitude: selectedStation.location.longitude,
            },
            { latitude: bus.latitude, longitude: bus.longitude }
          )}{" "}
          min
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  busStatusContainer: {
    padding: 10,
    marginVertical: 10,
    borderRadius: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 4,
    shadowColor: "black",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  busType: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
  },
  time: {
    fontSize: 18,
    color: "white",
  },
});
