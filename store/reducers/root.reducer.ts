import { createSlice } from "@reduxjs/toolkit";

const rootSlice = createSlice({
  name: "root",
  initialState: {
    selectedStation: {},
  },
  reducers: {
    setSelectedStation: (state, action) => {
      state.selectedStation = action.payload;
    },
  },
});

export const { setSelectedStation } = rootSlice.actions;
export default rootSlice.reducer;
