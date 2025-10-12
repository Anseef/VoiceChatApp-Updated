import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AppProvider } from './src/context/AppContext';
import { MenuProvider } from 'react-native-popup-menu';

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <MenuProvider>
          <AppNavigator />
        </MenuProvider>
      </NavigationContainer>
    </AppProvider>
  );
}