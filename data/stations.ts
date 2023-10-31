import Station from "../models/Station";

export const busStations: Station[] = [
  {
    title: "Stacioni Termokos",
    location: {
      latitude: 42.6528319,
      longitude: 21.174467,
      latitudeDelta: 0.001,
      longitudeDelta: 0.001,
    },
    description: "Nenstactioni i Termokosit",
    busesComing: [
      {
        bus: {
          type: "3",
          latitude: 42.0,
          longitude: 21,
        },
      },
    ],
  },
  {
    title: "Stacioni Maxi 24h",
    location: {
      latitude: 42.65223067684647,
      longitude: 21.176215186715122,
      latitudeDelta: 0.001,
      longitudeDelta: 0.001,
    },
    description: "Stacioni te Maxi 24h",
    busesComing: [
      {
        bus: {
          type: "3C",
          latitude: 42.0,
          longitude: 21,
        },
      },
    ],
  },
];
