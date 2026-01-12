import { combineReducers } from "@reduxjs/toolkit";
import jsonReducer from "./slices/jsonSlice";
import cartReducer from "./slices/cartSlice";

const rootReducer = combineReducers({
  json: jsonReducer,
  cart: cartReducer,
});

export default rootReducer;
