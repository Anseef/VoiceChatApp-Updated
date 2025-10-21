import React, { useState, useEffect, useRef } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    BackHandler,
    ActivityIndicator,
} from 'react-native';
import * as Speech from 'expo-speech';
import { useIsFocused } from '@react-navigation/native';
import { FontAwesome } from "@expo/vector-icons";
import Fuse from 'fuse.js';

import { imageMap } from '../utils/imageMap';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useAppContext } from '../context/AppContext';

const ContactsScreen = ({ navigation }) => {
    const { isAccessibilityMode, setAccessibilityMode, setIsAuthenticated, currentUser } = useAppContext();
    const { status, recognizedText, startListening, setRecognizedText } = useVoiceRecognition();

    const [activeChats, setActiveChats] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const isFocused = useIsFocused();
    const hasVisited = useRef(false);

    const fuse = useRef(new Fuse([], {
        keys: ['name'],
        threshold: 0.3,
        ignoreLocation: true,
        minMatchCharLength: 3
    }));

    // Effect to update Fuse.js collection when activeChats changes
    useEffect(() => {
        if (activeChats.length > 0) {
            fuse.current.setCollection(activeChats);
        } else {
            fuse.current.setCollection([]);
        }
    }, [activeChats]);
    
    useEffect(() => {
        const fetchActiveChats = async () => {
            setIsLoading(true);
            setFetchError(null);
            try {
                const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.180.131.188:3001';
                const response = await fetch(`${API_URL}/chats`);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to fetch active chats.');
                }
                const data = await response.json();
                const currentUserId = currentUser?._id;

                // 1. Filter chats to only show those where currentUserId is a participant
                const userChats = data.filter(chat => {
                    return chat.participant1Id === currentUserId || chat.participant2Id === currentUserId;
                });

                // 2. Sort the filtered chats by the most recent updatedAt timestamp
                const sortedChats = userChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                
                // 3. Set the state with the final sorted and filtered array
                setActiveChats(sortedChats);

            } catch (error) {
                console.error("Error fetching active chats:", error);
                setFetchError(error.message);
            } finally {
                setIsLoading(false);
            }
        };

        if (isFocused) {
            fetchActiveChats();
        }
    }, [isFocused, currentUser?._id]);
    
    // Effect for accessibility mode greetings and listening
    useEffect(() => {
        if (isFocused && isAccessibilityMode) {
            if (isLoading) return;

            if (fetchError) {
                Speech.stop();
                Speech.speak(`There was an error loading your chats: ${fetchError}`);
                return;
            }

            let message;
            if (!hasVisited.current) {
                message = "Welcome to your active chats. Say 'Chat with' and a name, 'add new chat', 'go to profile', or 'log out'.";
                hasVisited.current = true;
            } else {
                message = "You are on the chats screen. To open a chat, say 'chat with' and the person's name.";
            }

            Speech.stop();
            Speech.speak(message, { onDone: startListening });
        }

        return () => {
            Speech.stop();
        };
    }, [isFocused, isLoading, fetchError, isAccessibilityMode]);

    // Effect for voice command processing
    useEffect(() => {
        if (!isAccessibilityMode || status !== 'idle' || !recognizedText || !isFocused) return;

        const lowerCaseText = recognizedText.toLowerCase();

        if (lowerCaseText.includes('exit app')) {
            Speech.speak("Goodbye!");
            BackHandler.exitApp();
        } else if (lowerCaseText.includes('go to profile')) {
            Speech.speak("Navigating to profile.", { onDone: () => navigation.navigate('Profile') });
        } else if (lowerCaseText.includes('log out')) {
            Speech.speak("Logging you out. Goodbye!", { onDone: () => setIsAuthenticated(false) });
        } else if (lowerCaseText.includes('add new chat')) {
            Speech.speak("Opening new chat screen to add a person.", { onDone: () => navigation.navigate('AddChat') });
        } else {
            const match = lowerCaseText.match(/chat with (.*)/);
            if (match && match[1]) {
                let capturedName = match[1].trim();
                capturedName = capturedName.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s{2,}/g, " ");

                const searchResults = fuse.current.search(capturedName);
                let chat = null;
                if (searchResults.length > 0) {
                    chat = searchResults[0].item;
                }

                if (chat) {
                    Speech.speak(`Opening chat with ${chat.name}`);
                    navigation.navigate('Chat', { contact: chat });
                } else {
                    Speech.speak(`Sorry, I could not find an active chat with ${capturedName}. Try saying 'add new chat' to start one.`, { onDone: startListening });
                }
            } else {
                Speech.speak("Sorry, I didn't understand that command.", { onDone: startListening });
            }
        }
        setRecognizedText('');
    }, [recognizedText, status, activeChats, isAccessibilityMode, isFocused, navigation, setIsAuthenticated, setRecognizedText, startListening]);

    // Helper function to format the timestamp
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';

        const now = new Date();
        const messageDate = new Date(timestamp);

        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMessageDate = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());

        const yesterday = new Date(startOfToday);
        yesterday.setDate(yesterday.getDate() - 1);

        if (startOfMessageDate.getTime() === startOfToday.getTime()) {
            // This line is updated to explicitly force the 12-hour format
            return messageDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        }

        if (startOfMessageDate.getTime() === yesterday.getTime()) {
            return "Yesterday";
        }

        return messageDate.toLocaleDateString();
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <ActivityIndicator size="large" color="#586eeb" />
                <Text style={{ marginTop: 10 }}>Loading your active chats...</Text>
            </SafeAreaView>
        );
    }

    if (fetchError) {
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <Text style={styles.errorText}>Error loading chats:</Text>
                <Text style={styles.errorText}>{fetchError}</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerBar}>
                <Text style={styles.headerTitle}>Chats</Text>
                <TouchableOpacity
                    style={styles.toggleIcon}
                    onPress={() => setAccessibilityMode(!isAccessibilityMode)}
                >
                    {isAccessibilityMode ? (
                        <FontAwesome name="low-vision" size={25} color="#586eeb" />
                    ) : (
                        <FontAwesome name="eye" size={25} color="#000" />
                    )}
                </TouchableOpacity>
            </View>
            {activeChats.length === 0 ? (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No Active Chats</Text>
                <Text style={styles.emptySubText}>To start a conversation go to add chats.</Text>
            </View>)
            :
            (<FlatList
                data={activeChats}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => {
                    const imageSource = imageMap[item.image] || { uri: item.image } || require('../../assets/profileDemo.jpg');
                    return (
                        <TouchableOpacity 
                            style={styles.contactItem}
                            onPress={() => {
                                navigation.navigate('Chat', { contact: item });
                            }}
                        >
                            <Image
                                source={imageSource}
                                style={styles.contactImage}
                            />
                            <View style={styles.contactInfo}>
                                <Text style={styles.contactName}>{item.name}</Text>
                                <Text style={styles.contactMessage} numberOfLines={1}>{item.lastMessage}</Text>
                            </View>
                            <View style={styles.contactMeta}>
                                <Text style={styles.contactTime}>{formatTimestamp(item.updatedAt)}</Text>
                                {item.unread > 0 && (
                                    <View style={styles.unreadBadge}>
                                        <Text style={styles.unreadText}>{item.unread}</Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />)}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    errorText: {
        color: 'red',
        fontSize: 16,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    headerBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 30,
        backgroundColor: '#fff'
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold'
    },
    toggleIcon: {
        padding: 5,
    },
    contactItem: {
        flexDirection: 'row',
        padding: 14,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0'
    },
    contactImage: {
        width: 55,
        height: 55,
        borderRadius: 27.5,
        marginRight: 15,
        backgroundColor: '#eee'
    },
    contactInfo: {
        flex: 1
    },
    contactName: {
        fontSize: 17,
        fontWeight: 'bold'
    },
    contactMessage: {
        fontSize: 14,
        color: '#a5addcff',
        marginTop: 2
    },
    contactMeta: {
        alignItems: 'flex-end'
    },
    contactTime: {
        fontSize: 13,
        color: '#888'
    },
    unreadBadge: {
        backgroundColor: '#586eeb',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 5
    },
    unreadText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    emptySubText: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
    },
});

export default ContactsScreen;