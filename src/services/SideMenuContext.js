import React, { createContext, useContext } from "react";

const SideMenuContext = createContext({
  isOpen: false,
  hasSideNav: false,
  toggleSideMenu: () => {},
  openSideMenu: () => {},
  closeSideMenu: () => {},
});

export const useSideMenu = () => useContext(SideMenuContext);

export const SideMenuProvider = SideMenuContext.Provider;

export default SideMenuContext;
