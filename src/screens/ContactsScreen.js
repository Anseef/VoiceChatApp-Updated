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
import { imageMap } from '../utils/imageMap'; // Assuming imageMap is for your *chat* profile images

import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useAppContext } from '../context/AppContext';

const ContactsScreen = ({ navigation }) => {
    const { isAccessibilityMode, setAccessibilityMode, setIsAuthenticated, currentUser } = useAppContext();
    const { status, recognizedText, startListening, setRecognizedText } = useVoiceRecognition();

    const [activeChats, setActiveChats] = useState([]); // State to hold active chats from DB
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const isFocused = useIsFocused();
    const hasVisited = useRef(false);
    
    useEffect(() => {
        const fetchActiveChats = async () => {
            setIsLoading(true);
            setFetchError(null);
            try {
                const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.180.131.188:3001'; // Use environment variable
                const response = await fetch(`${API_URL}/chats`); // NEW ENDPOINT

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to fetch active chats.');
                }
                const data = await response.json();

                // Filter chats to only show those where currentUserId is a participant
                const currentUserId = currentUser?._id;
                const userChats = data.filter(chat => {
                    const chatP1 = chat.participant1Id;
                    const chatP2 = chat.participant2Id;
                    const match = chatP1 === currentUserId || chatP2 === currentUserId;
                    return match;
                    });

                setActiveChats(userChats); // Store active chats in local state
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
    }, [isFocused]);

    // --- Original useEffect for accessibility mode greetings and listening ---
useEffect(() => {
  if (isFocused && isAccessibilityMode) {
    if (isLoading) return;

    if (fetchError) {
      Speech.stop(); // stop previous speech if any
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

    // 🛑 Stop overlapping speech before speaking new message
    Speech.stop();
    Speech.speak(message, { onDone: startListening });
  }

  // 🧹 Cleanup when screen is unfocused
  return () => {
    Speech.stop();
  };
}, [isFocused, isLoading, fetchError, isAccessibilityMode]);


    // --- Original useEffect for voice command processing ---
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
        } else if (lowerCaseText.includes('add new chat')) { // Changed command to be specific
            Speech.speak("Opening new chat screen to add a person.", { onDone: () => navigation.navigate('AddChat') });
        } else {
            const match = lowerCaseText.match(/chat with (.*)/);
            console.log(match);

            if (match && match[1]) {
                let capturedName = match[1].trim();
                capturedName = capturedName.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s{2,}/g, " ");

                // --- MODIFIED: Find contact in activeChats ---
                const chat = activeChats.find(c => c.name && c.name.toLowerCase() === capturedName);

                if (chat) {
                    Speech.speak(`Opening chat with ${chat.name}`);
                    navigation.navigate('Chat', {
                        contact: {
                            _id: chat._id, // Use chat ID as contact ID for consistency
                            name: chat.name,
                            image: chat.image, // Use image from chat data
                            lastMessage: chat.lastMessage,
                            time: chat.time,
                            unread: chat.unread,
                            // ** THESE ARE THE MISSING PIECES FOR VOICE COMMAND NAVIGATION **
                            participant1Id: chat.participant1Id,
                            participant2Id: chat.participant2Id,
                        }
                    });
                } else {
                    Speech.speak(`Sorry, I could not find an active chat with ${capturedName}. Try saying 'add new chat' to start one.`, { onDone: startListening });
                }
            } else {
                Speech.speak("Sorry, I didn't understand that command.", { onDone: startListening });
            }
        }
        setRecognizedText('');
    }, [recognizedText, status, activeChats, isAccessibilityMode, isFocused, navigation, setIsAuthenticated]);


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
            <FlatList
                data={activeChats} // Render active chats
                keyExtractor={(item) => item._id} // Use chat ID
                renderItem={({ item }) => {
                    const imageSource = imageMap[item.image] || { uri: item.image } || require('../../assets/profileDemo.jpg');
                    return (
                        <TouchableOpacity style={styles.contactItem}
                            onPress={() => {
                                navigation.navigate('Chat', {
                                    contact: {
                                        _id: item._id,
                                        name: item.name,
                                        image: item.image,
                                        lastMessage: item.lastMessage,
                                        time: item.time,
                                        unread: item.unread,
                                        // ** THESE ARE THE MISSING PIECES FOR FLATLIST NAVIGATION **
                                        participant1Id: item.participant1Id,
                                        participant2Id: item.participant2Id,
                                    }
                                });
                            }}
                        >
                            <Image
                                source={imageSource}
                                style={styles.contactImage}
                            />
                            <View style={styles.contactInfo}>
                                <Text style={styles.contactName}>{item.name}</Text>
                                <Text style={styles.contactMessage}>{item.lastMessage}</Text>
                            </View>
                            <View style={styles.contactMeta}>
                                <Text style={styles.contactTime}>{item.time}</Text>
                                {item.unread > 0 && (<View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.unread}</Text></View>)}
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />
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
});

export default ContactsScreen;