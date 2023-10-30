import React, { useState } from "react";
import { View, Text, Modal, StyleSheet, Button, FlatList } from "react-native";
import BusStatus from "./home/BusStatus";
import Bus from "../../models/Bus";

interface Props {
  visible: boolean;
  onClose: () => any;
  title: string;
  text: string;
  data: { bus: Bus; timeLeft: number }[];
}

export default function UiModal({ visible, onClose, title, data }: Props) {
  const [show, setShow] = useState(false);
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Button title="Close" onPress={onClose} />
          <Text style={styles.title}>{title}</Text>
          <FlatList
            data={data}
            renderItem={(itemData) => <BusStatus {...itemData.item} />}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    width: "100%",
    height: "50%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  title: {
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 26,
    marginBottom: 10,
  },
});
