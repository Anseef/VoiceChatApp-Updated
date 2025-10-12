// src/navigation/AppNavigator.js

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAppContext } from '../context/AppContext';

// Import Screens
import ContactsScreen from '../screens/ContactsScreen';
import ChatScreen from '../screens/ChatScreen';
import AddChatScreen from '../screens/AddChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AuthScreen from '../screens/AuthScreen';
import Icon from 'react-native-vector-icons/Ionicons';
import CallScreen from '../screens/CallScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// This is the custom button component for the tab bar
const CustomTabBarButton = ({ children, onPress }) => (
    <TouchableOpacity
        style={{
            top: -25,
            justifyContent: 'center',
            alignItems: 'center',
        }}
        onPress={onPress}
    >
        {/* --- FIX START --- */}
        {/* Added justifyContent and alignItems to center the '+' icon inside the blue circle */}
        <View style={{
            width: 70,
            height: 70,
            borderRadius: 35,
            backgroundColor: '#161616ff',
            justifyContent: 'center',
            alignItems: 'center'
        }}>
        {/* --- FIX END --- */}
            {children}
        </View>
    </TouchableOpacity>
);

// A Tab Navigator for only the screens that need a bottom bar
const HomeTabs = () => {
  return (
    <Tab.Navigator
        screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: {
                position: 'absolute',
                left: 20,
                right: 20,
                backgroundColor: '#ffffff',
                borderRadius: 15,
                height: 55,
            }
        }}
    >
        <Tab.Screen name="Chats" component={ContactsScreen} options={{
            tabBarIcon: ({ focused }) => (
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="chatbubble-ellipses-outline" size={25} color={focused ? '#81b0ff' : '#748c94'} />
                </View>
            ),
        }} />
        <Tab.Screen name="Add New Chat" component={AddChatScreen} options={{
            // --- FIX: Simplified the tabBarIcon to return only the Icon ---
            tabBarIcon: () => (
                <Icon name="add" size={30} color="#fff" />
            ),
            tabBarButton: (props) => (
                <CustomTabBarButton {...props} />
            )
        }} 
        listeners={({ navigation }) => ({
            tabPress: e => {
                e.preventDefault();
                navigation.navigate('AddChat');
            },
        })}
        />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{
            tabBarIcon: ({ focused }) => (
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="person-outline" size={25} color={focused ? '#81b0ff' : '#748c94'} />
                </View>
            ),
        }} />
    </Tab.Navigator>
  );
};

// A Stack Navigator to manage the entire authenticated app flow
const MainAppStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeTabs} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="AddChat" component={AddChatScreen} />
      <Stack.Screen name="Call" component={CallScreen} />
    </Stack.Navigator>
  );
}

export const AppNavigator = () => {
    const { isAuthenticated } = useAppContext();
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {isAuthenticated ? (
                <Stack.Screen name="MainApp" component={MainAppStack} />
            ) : (
                <Stack.Screen name="Auth" component={AuthScreen} />
            )}
        </Stack.Navigator>
    );
};