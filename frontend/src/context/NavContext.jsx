import { createContext, useContext } from 'react';

export const NavCtx = createContext({
  push: () => {},
  goto: () => {},
  back: () => {},
  reset: () => {},
});

export const useNav = () => useContext(NavCtx);
