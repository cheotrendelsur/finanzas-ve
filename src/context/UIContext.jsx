import { createContext, useContext, useState } from 'react';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const [showBottomNav, setShowBottomNav] = useState(true);

  const hideBottomNav = () => setShowBottomNav(false);
  const showNav = () => setShowBottomNav(true);

  return (
    <UIContext.Provider value={{ showBottomNav, hideBottomNav, showNav }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within UIProvider');
  }
  return context;
};