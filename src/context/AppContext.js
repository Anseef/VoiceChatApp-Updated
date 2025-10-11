import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage'; // We'll add this back for persistence

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [isAccessibilityMode, setAccessibilityMode] = useState(true);
    const [contacts, setContacts] = useState([]);
    const [conversations, setConversations] = useState({});

    useEffect(() => {
        const loadAuthState = async () => {
            try {
                const storedAuth = await AsyncStorage.getItem('isAuthenticated');
                const storedUser = await AsyncStorage.getItem('currentUser');
                if (storedAuth === 'true' && storedUser) {
                    setIsAuthenticated(true);
                    setCurrentUser(JSON.parse(storedUser)); // Parse the stored JSON string back to an object
                }
            } catch (error) {
                console.error("Failed to load auth state from storage", error);
            }
        };
        loadAuthState();
    }, []);

    useEffect(() => {
        const saveAuthState = async () => {
            try {
                await AsyncStorage.setItem('isAuthenticated', isAuthenticated.toString());
                if (isAuthenticated && currentUser) {
                    await AsyncStorage.setItem('currentUser', JSON.stringify(currentUser));
                } else {
                    await AsyncStorage.removeItem('currentUser'); // Clear user data on logout
                }
            } catch (error) {
                console.error("Failed to save auth state to storage", error);
            }
        };
        saveAuthState();
    }, [isAuthenticated, currentUser]);

    
    const value = {
        isAuthenticated,
        setIsAuthenticated,
        currentUser,
        setCurrentUser,
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