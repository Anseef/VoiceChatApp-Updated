import React, { createContext, useContext, useState, useEffect } from 'react';
// import AsyncStorage from '@react-native-async-storage/async-storage'; // No longer needed for global auth check here

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    // Hardcode isAuthenticated to true since we're bypassing login
    const [isAuthenticated, setIsAuthenticated] = useState(true); // <--- CHANGED
    const [isAccessibilityMode, setAccessibilityMode] = useState(false);
    const [contacts, setContacts] = useState([]); // This will be used by AddChatScreen
    const [conversations, setConversations] = useState({}); // Local state for simulated replies (might be fully replaced by DB in ChatScreen)

    // Remove the useEffect that checks AsyncStorage for authentication if it exists

    const value = {
        isAuthenticated,
        setIsAuthenticated,
        isAccessibilityMode,
        setAccessibilityMode,
        contacts,
        setContacts,
        conversations,
        setConversations
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    return useContext(AppContext);
};