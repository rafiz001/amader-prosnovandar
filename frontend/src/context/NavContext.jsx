import { createContext, useContext } from 'react';

export const NavCtx = createContext({
  push: () => {},
  goto: () => {},
  back: () => {},
  reset: () => {},
  setLabel: () => {},
});

export const useNav = () => useContext(NavCtx);
