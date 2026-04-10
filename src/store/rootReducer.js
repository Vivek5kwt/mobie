import { combineReducers } from "@reduxjs/toolkit";
import jsonReducer from "./slices/jsonSlice";
import cartReducer from "./slices/cartSlice";
import wishlistReducer from "./slices/wishlistSlice";

const rootReducer = combineReducers({
  json: jsonReducer,
  cart: cartReducer,
  wishlist: wishlistReducer,
});

export default rootReducer;
