import { createSlice } from "@reduxjs/toolkit";

const jsonSlice = createSlice({
  name: "json",
  initialState: {
    home: {},
    cart: {},
    profile: {},
    notification: {},
  },
  reducers: {
    setScreenJson(state, action) {
      const { screen, data } = action.payload;
      state[screen] = data;
    },
  },
});

export const { setScreenJson } = jsonSlice.actions;
export default jsonSlice.reducer;
