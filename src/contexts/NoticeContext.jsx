import { createContext, useContext } from 'react';

export const NoticeContext = createContext(null);

export function useNotice() {
  const context = useContext(NoticeContext);
  if (!context) {
    throw new Error('useNotice must be used within NoticeProvider');
  }
  return context;
}
