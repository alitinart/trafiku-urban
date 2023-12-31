export default interface Bus {
  type: "3C" | "3B" | "3" | "5";
  location: {
    latitude: number;
    longitude: number;
  };
}

export function returnBusColor(type: string) {
  switch (type) {
    case "3C":
      return "#3D348B";
    case "3":
      return "#7678ED";
    case "5":
      return "#F7B801";
    case "3B":
      return "#FBBC05";
  }
}
