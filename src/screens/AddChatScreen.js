// AddChatScreen.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    SafeAreaView, View, Text, StyleSheet, FlatList,
    ActivityIndicator, TouchableOpacity, Alert, Platform,
    Image
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
    const { status, recognizedText, error, startListening, setRecognizedText } = useVoiceRecognition(); // Removed stopListening from here

    const [phoneContacts, setPhoneContacts] = useState([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(true);
    const [isLoading, setIsLoading] = useState(false); // Used for chat creation
    const [fetchError, setFetchError] = useState(null);
    

    const currentUserId = currentUser?._id;
    const currentUserName = currentUser?.username;

    const speakingActive = useRef(false);
    const hasSpokenGreeting = useRef(false);

    // --- Fuse.js for fuzzy matching contacts ---
    const fuse = useRef(new Fuse([], {
        keys: ['name'], // Search by contact name
        threshold: 0.3,  // Adjust for desired fuzziness (0 = exact, 1 = very loose)
        ignoreLocation: true,
        minMatchCharLength: 3
    }));

    // Effect to update Fuse.js collection when phoneContacts changes
    useEffect(() => {
        if (phoneContacts.length > 0) {
            fuse.current.setCollection(phoneContacts);
        } else {
            fuse.current.setCollection([]);
        }
    }, [phoneContacts]);
    // --- End Fuse.js setup ---


    // --- EFFECT TO CLEAR STALE TEXT ON FOCUS ---
    useEffect(() => {
        if (isFocused) {
            setRecognizedText('');
            hasSpokenGreeting.current = false; // Reset greeting flag
        }
    }, [isFocused, setRecognizedText]);

    useEffect(() => {
        const loadContacts = async () => {
            setIsLoadingContacts(true);
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
                    } else {
                        console.log("No contacts found.");
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
        };

        if (isFocused) {
            loadContacts();
        }
    }, [isFocused]);

    // --- ACCESSIBILITY GREETING (RUNS ONLY ONCE PER FOCUS) ---
    useEffect(() => {
        if (isFocused && isAccessibilityMode && !isLoadingContacts && !hasSpokenGreeting.current) {
            if (status === 'idle' && !speakingActive.current) {
                const message = "You are on the add new chat screen. Say the name of the person you want to chat with, or say 'go back'.";
                console.log("ADD_CHAT_SCREEN: Initiating ONE-TIME greeting.");
                speakingActive.current = true;
                Speech.speak(message, {
                    onDone: () => {
                        speakingActive.current = false;
                        startListening();
                    },
                    onError: () => {
                        speakingActive.current = false;
                    }
                });
                hasSpokenGreeting.current = true; // Mark as spoken
            }
        }
    }, [isFocused, isAccessibilityMode, isLoadingContacts, status, startListening]);


    // --- VOICE COMMAND PROCESSING ---
    useEffect(() => {
        // Only process if in accessibility mode, focused, recognition is idle, recognized text exists, and not currently speaking
        if (!isAccessibilityMode || !isFocused || status !== 'idle' || !recognizedText || speakingActive.current) {
            return;
        }

        const lowerCaseText = recognizedText.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
        console.log("ADD_CHAT_SCREEN: Processing command:", lowerCaseText);

        // Clear recognized text immediately to prevent re-processing
        setRecognizedText('');

        speakingActive.current = true; // Indicate that speech is about to happen

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

        // --- Fuzzy search for the contact ---
        const searchResults = fuse.current.search(lowerCaseText);
        console.log("Fuse search results for:", lowerCaseText, searchResults);

        let matchingContact = null;
        if (searchResults.length > 0) {
            matchingContact = searchResults[0].item; // Take the first best match
        }


        if (matchingContact) {
            if (!isLoading) { // Ensure chat creation isn't already in progress
                initiateChat(matchingContact);
            } else {
                // If loading, probably means a chat creation is already in progress from a previous command
                Speech.speak("Please wait, I'm already trying to start a chat.", {
                    onDone: () => {
                        speakingActive.current = false;
                        if (isAccessibilityMode) startListening();
                    },
                    onError: () => speakingActive.current = false
                });
            }
        } else {
            Speech.speak(`Sorry, I couldn't find a contact named ${recognizedText}. Please try again.`, {
                onDone: () => {
                    speakingActive.current = false;
                    if (isAccessibilityMode) startListening();
                },
                onError: () => speakingActive.current = false
            });
        }

    }, [recognizedText, status, isFocused, isAccessibilityMode, isLoading, navigation]);


    const initiateChat = useCallback(async (contact) => {
        if (isLoading) return; // Double check if already loading
        setIsLoading(true);

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

            // SOLUTION 2: Use onDone for reliable navigation after speaking
            speakingActive.current = true; // Set speaking status
            Speech.speak(`Starting chat with ${newChat.name}.`, {
                onDone: () => {
                    speakingActive.current = false; // Speech done
                    // No need to stopListening here, as we're navigating away,
                    // and the component will unmount.
                    navigation.navigate('Chat', {
                        contact: {
                            _id: newChat._id,
                            name: newChat.name,
                            participant1Id: newChat.participant1Id,
                            participant2Id: newChat.participant2Id,
                            image: newChat.image || 'profileDemo.jpg',
                            lastMessage: newChat.lastMessage || "",
                            time: newChat.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            unread: newChat.unread || 0,
                        }
                    });
                },
                onError: () => speakingActive.current = false
            });

        } catch (error) {
            console.error("Error initiating chat:", error);
            speakingActive.current = true; // Set speaking status for error message
            Speech.speak(`Failed to start chat. ${error.message}. Please try again.`, {
                onDone: () => {
                    speakingActive.current = false;
                    if (isAccessibilityMode) startListening(); // Allow user to try again
                },
                onError: () => speakingActive.current = false
            });
        } finally {
            setIsLoading(false); // Reset loading state
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

            {isLoadingContacts ? (
                <View style={styles.centeredView}>
                    <ActivityIndicator size="large" color="#586eeb" />
                    <Text style={styles.loadingText}>Loading contacts...</Text>
                </View>
            ) : fetchError ? (
                <View style={styles.centeredView}>
                    <Text style={styles.errorText}>{fetchError}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => { /* re-attempt loadContacts or goBack */ }}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={phoneContacts}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.contactItem}
                            onPress={() => initiateChat(item)}
                            disabled={isLoading || speakingActive.current} // Disable if creating chat or speaking
                        >
                            <Image
                                source={item.imageAvailable && item.image.uri
                                    ? { uri: item.image.uri }
                                    : require('../../assets/profileDemo.jpg')}
                                style={styles.contactImage}
                            />
                            <Text style={styles.contactName}>{item.name}</Text>
                            {(isLoading && item.id.toString() === currentUser?._id) && ( // Only show loading for the selected item
                                <View style={styles.loadingOverlay}>
                                    <ActivityIndicator size="small" color="#586eeb" />
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                />
            )}
            {/* Listening indicator when in accessibility mode and microphone is active and not speaking */}
            {isAccessibilityMode && status === 'listening' && !speakingActive.current && (
                <View style={styles.listeningIndicator}>
                    <ActivityIndicator size="small" color="#586eeb" />
                    <Text style={{ marginLeft: 5 }}>Listening...</Text>
                </View>
            )}
            {/* Optional error display for voice recognition */}
            {isAccessibilityMode && error && (
                <View style={styles.listeningIndicator}>
                    <Text style={{ color: 'red' }}>Voice Error: {error}</Text>
                </View>
            )}
            {/* Optional recognized text display */}
            {isAccessibilityMode && recognizedText && status !== 'listening' && (
                <View style={styles.listeningIndicator}>
                    <Text style={{ color: '#555' }}>Heard: {recognizedText}</Text>
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
        position: 'relative',
    },
    contactImage: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
    contactName: { fontSize: 15, fontWeight: '500' },
    loadingOverlay: {
        position: 'absolute',
        top: 0, bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(255,255,255,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Styles for the listening indicator
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