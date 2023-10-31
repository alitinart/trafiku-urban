import { StatusBar } from "expo-status-bar";
import Home from "./screens/Home";
import { Provider } from "react-redux";
import store from "./store/store";
import { SafeAreaView } from "react-native";

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaView style={{ flex: 1 }}>
        <Home></Home>
        <StatusBar style="auto" />
      </SafeAreaView>
    </Provider>
  );
}
