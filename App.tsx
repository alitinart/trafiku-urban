import { StatusBar } from "expo-status-bar";
import Home from "./screens/Home";
import { Provider } from "react-redux";
import store from "./store/store";

export default function App() {
  return (
    <Provider store={store}>
      <Home></Home>
      <StatusBar style="auto" />
    </Provider>
  );
}
