import { Region } from "react-native-maps";
import Bus from "./Bus";

export default interface Station {
  title: string;
  location: Region;
  description: string;
  busesComing: { bus: Bus; timeLeft: number }[];
}
