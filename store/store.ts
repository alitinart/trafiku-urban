import { configureStore } from "@reduxjs/toolkit";
import rootSlice from "./reducers/root.reducer";

const store = configureStore({
  reducer: rootSlice,
});

export default store;
