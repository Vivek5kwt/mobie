import { combineReducers } from "@reduxjs/toolkit";
import jsonReducer from "./slices/jsonSlice";

const rootReducer = combineReducers({
  json: jsonReducer,
});

export default rootReducer;
