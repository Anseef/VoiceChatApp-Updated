// AddChatScreen.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    SafeAreaView, View, Text, StyleSheet, FlatList,
    ActivityIndicator, TouchableOpacity, Alert, Platform,
    Image,
    TextInput // <-- Import TextInput
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { useAppContext } from '../context/AppContext';
import { FontAwesome } from '@expo/vector-icons';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import Fuse from 'fuse.js';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.180.131.188:3001';

const AddChatScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const { isAccessibilityMode, currentUser } = useAppContext();
    const { status, recognizedText, error, startListening, setRecognizedText } = useVoiceRecognition();

    // --- State for contacts and search bar ---
    const [phoneContacts, setPhoneContacts] = useState([]);
    const [filteredContacts, setFilteredContacts] = useState([]); // For displaying search results
    const [searchQuery, setSearchQuery] = useState('');          // For the search input text

    const [isLoadingContacts, setIsLoadingContacts] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);
    
    const currentUserId = currentUser?._id;
    const currentUserName = currentUser?.username;

    const speakingActive = useRef(false);
    const hasSpokenGreeting = useRef(false);

    const fuse = useRef(new Fuse([], {
        keys: ['name'],
        threshold: 0.3,
        ignoreLocation: true,
        minMatchCharLength: 3
    }));

    useEffect(() => {
        fuse.current.setCollection(phoneContacts.length > 0 ? phoneContacts : []);
    }, [phoneContacts]);

    // --- EFFECT TO FILTER CONTACTS BASED ON SEARCH QUERY (for non-accessibility mode) ---
    useEffect(() => {
        if (!searchQuery) {
            setFilteredContacts(phoneContacts);
        } else {
            const lowercasedQuery = searchQuery.toLowerCase();
            const filtered = phoneContacts.filter(contact =>
                contact.name.toLowerCase().includes(lowercasedQuery)
            );
            setFilteredContacts(filtered);
        }
    }, [searchQuery, phoneContacts]);

    useEffect(() => {
        if (isFocused) {
            setRecognizedText('');
            hasSpokenGreeting.current = false;
        }
    }, [isFocused, setRecognizedText]);
    
    const loadContacts = useCallback(async () => {
        setIsLoadingContacts(true);
        setFetchError(null); // Reset error on retry
        try {
            const { status: permissionStatus } = await Contacts.requestPermissionsAsync();
            if (permissionStatus === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.Emails, Contacts.Fields.Image],
                });
                if (data.length > 0) {
                    const sortedContacts = data
                        .filter(c => c.name && c.id)
                        .sort((a, b) => a.name.localeCompare(b.name));
                    setPhoneContacts(sortedContacts);
                    setFilteredContacts(sortedContacts); // Initialize filtered list
                } else {
                    Alert.alert("No Contacts", "No contacts found on your device.");
                }
            } else {
                Alert.alert('Permission denied', 'Access to contacts is required to add new chats.');
                setFetchError('Contact permission denied.');
            }
        } catch (error) {
            console.error("Error loading contacts:", error);
            Alert.alert("Error", `Failed to load contacts: ${error.message}`);
            setFetchError(`Failed to load contacts: ${error.message}`);
        } finally {
            setIsLoadingContacts(false);
        }
    }, []);


    useEffect(() => {
        if (isFocused) {
            loadContacts();
        }
    }, [isFocused, loadContacts]);

    useEffect(() => {
        if (isFocused && isAccessibilityMode && !isLoadingContacts && !hasSpokenGreeting.current) {
            if (status === 'idle' && !speakingActive.current) {
                const message = "You are on the add new chat screen. Say the name of the person you want to chat with, or say 'go back'.";
                speakingActive.current = true;
                Speech.speak(message, {
                    onDone: () => {
                        speakingActive.current = false;
                        startListening();
                    },
                    onError: () => speakingActive.current = false
                });
                hasSpokenGreeting.current = true;
            }
        }
    }, [isFocused, isAccessibilityMode, isLoadingContacts, status, startListening]);

    useEffect(() => {
        if (!isAccessibilityMode || !isFocused || status !== 'idle' || !recognizedText || speakingActive.current) return;

        const lowerCaseText = recognizedText.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
        setRecognizedText('');
        speakingActive.current = true;

        if (lowerCaseText === 'go back') {
            Speech.speak("Going back.", {
                onDone: () => {
                    speakingActive.current = false;
                    navigation.goBack();
                },
                onError: () => speakingActive.current = false
            });
            return;
        }

        const searchResults = fuse.current.search(lowerCaseText);
        let matchingContact = searchResults.length > 0 ? searchResults[0].item : null;

        if (matchingContact) {
            if (!isLoading) {
                initiateChat(matchingContact);
            } else {
                Speech.speak("Please wait, I'm already trying to start a chat.", {
                    onDone: () => {
                        speakingActive.current = false;
                        if (isAccessibilityMode) startListening();
                    },
                    onError: () => speakingActive.current = false
                });
            }
        } else {
            Speech.speak(`Sorry, I couldn't find a contact by this name. Please try again.`, {
                onDone: () => {
                    speakingActive.current = false;
                    if (isAccessibilityMode) startListening();
                },
                onError: () => speakingActive.current = false
            });
        }
    }, [recognizedText, status, isFocused, isAccessibilityMode, isLoading, navigation, initiateChat, setRecognizedText]);

    const initiateChat = useCallback(async (contact) => {
        if (isLoading) return;
        setIsLoading(true);

        // This function body remains unchanged
        // ... (omitted for brevity, it's the same as your provided code)
        try {
            const response = await fetch(`${API_URL}/chats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderId: currentUserId,
                    senderName: currentUserName,
                    partnerId: contact.id.toString(),
                    partnerName: contact.name,
                    partnerImage: contact.imageAvailable && contact.image.uri ? contact.image.uri : null,
                }),
            });
            if (!response.ok && response.status !== 200) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create chat.');
            }
            const responseData = await response.json();
            const newChat = responseData.chat;
            
            Speech.speak(`Starting chat with ${newChat.name}.`, {
                onDone: () => {
                    navigation.navigate('Chat', {
                        contact: {
                            _id: newChat._id, name: newChat.name,
                            image: newChat.image || 'profileDemo.jpg',
                            // ... other necessary fields
                        }
                    });
                },
            });
        } catch (error) {
            console.error("Error initiating chat:", error);
            Speech.speak(`Failed to start chat. ${error.message}. Please try again.`, {
                onDone: () => {
                    speakingActive.current = false;
                    if (isAccessibilityMode) startListening();
                },
                onError: () => speakingActive.current = false
            });
        } finally {
            setIsLoading(false);
        }

    }, [isLoading, navigation, currentUserId, currentUserName, isAccessibilityMode]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <FontAwesome name="chevron-left" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add New Chat</Text>
            </View>

            {/* --- NEW: CONDITIONAL SEARCH BAR --- */}
            {!isAccessibilityMode && (
                <View style={styles.searchContainer}>
                    <FontAwesome name="search" size={18} color="#999" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search contacts by name..."
                        placeholderTextColor="#999"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            )}

            {isLoadingContacts ? (
                <View style={styles.centeredView}>
                    <ActivityIndicator size="large" color="#586eeb" />
                    <Text style={styles.loadingText}>Loading contacts...</Text>
                </View>
            ) : fetchError ? (
                <View style={styles.centeredView}>
                    <Text style={styles.errorText}>{fetchError}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={loadContacts}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={filteredContacts} // <-- Use filtered data
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.contactItem}
                            onPress={() => initiateChat(item)}
                            disabled={isLoading || speakingActive.current}
                        >
                            <Image
                                source={item.imageAvailable && item.image.uri
                                    ? { uri: item.image.uri }
                                    : require('../../assets/profileDemo.jpg')}
                                style={styles.contactImage}
                            />
                            <Text style={styles.contactName}>{item.name}</Text>
                        </TouchableOpacity>
                    )}
                />
            )}
            
            {/* Listening indicators remain unchanged */}
            {isAccessibilityMode && status === 'listening' && !speakingActive.current && (
                <View style={styles.listeningIndicator}>
                    <ActivityIndicator size="small" color="#586eeb" />
                    <Text style={{ marginLeft: 5 }}>Listening...</Text>
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'android' ? 50 : 50,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    backButton: { marginRight: 15 },
    headerTitle: { fontSize: 22, fontWeight: 'bold' },
    // --- NEW: Styles for Search Bar ---
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eeeff5ff',
        borderRadius: 10,
        marginVertical: 10,
        marginHorizontal: 15,
    },
    searchIcon: {
        padding: 12,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 14,
        paddingRight: 10,
        borderRadius: 10,
        fontSize: 16,
        color: '#333',
        backgroundColor: '#eeeff5ff'
    },
    centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
    errorText: { color: 'red', fontSize: 16, textAlign: 'center', marginHorizontal: 20 },
    retryButton: {
        marginTop: 20,
        backgroundColor: '#586eeb',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 25,
    },
    retryButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    contactImage: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
    contactName: { fontSize: 15, fontWeight: '500' },
    listeningIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        backgroundColor: '#f0f0f0',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
});

export default AddChatScreen;