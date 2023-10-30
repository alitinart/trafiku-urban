import { StyleSheet, Text, View } from "react-native";
import Bus, { returnBusColor } from "../../../models/Bus";

interface Props {
  bus: Bus;
  timeLeft: number;
}

export default function BusStatus({ bus, timeLeft }: Props) {
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
        <Text style={styles.time}>{timeLeft} min</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  busStatusContainer: {
    padding: 10,
    height: 50,
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
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
  },
  time: {
    fontSize: 18,
    color: "white",
  },
});
