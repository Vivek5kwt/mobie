import { combineReducers } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { persistReducer } from "redux-persist";
import jsonReducer from "./slices/jsonSlice";
import cartReducer from "./slices/cartSlice";
import wishlistReducer from "./slices/wishlistSlice";

const cartPersistConfig = {
  key: "cart",
  version: 1,
  storage: AsyncStorage,
  whitelist: ["items"],
};

const rootReducer = combineReducers({
  json: jsonReducer,
  cart: persistReducer(cartPersistConfig, cartReducer),
  wishlist: wishlistReducer,
});

export default rootReducer;
