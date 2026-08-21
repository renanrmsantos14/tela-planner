import { createContext, useContext } from 'react';

export const StateContext = createContext(null);

export function useAppState() {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error('useAppState must be used within StateProvider');
  }
  return context;
}
