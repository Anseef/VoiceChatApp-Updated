import React, { useState, useEffect, useRef } from 'react';
import {
    SafeAreaView, View, Text, StyleSheet, FlatList,
    TouchableOpacity, TextInput, KeyboardAvoidingView,
    Platform, Image, BackHandler, ActivityIndicator,
    Alert
} from 'react-native';
import * as Speech from 'expo-speech';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useAppContext } from '../context/AppContext';
import { FontAwesome } from "@expo/vector-icons";
import { useHeaderHeight } from '@react-navigation/elements';
import { imageMap } from '../utils/imageMap';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.180.131.188:3001';

const ChatScreen = ({ route, navigation }) => {
    const { isAccessibilityMode } = useAppContext();
    const contact = route?.params?.contact; // This `contact` is actually the `chat` object from DB
    const headerHeight = useHeaderHeight();

    const [messages, setMessages] = useState([]);
    const [textInput, setTextInput] = useState('');
    const currentUserId = "yato";

    const [isLoadingMessages, setIsLoadingMessages] = useState(true);
    const [messageFetchError, setMessageFetchError] = useState(null);

    const { status, recognizedText, error, startListening, setRecognizedText } = useVoiceRecognition();
    const flatListRef = useRef(null);

    // --- Debugging logs at component render ---
    useEffect(() => {
        // console.log("ChatScreen Render - currentUserId:", currentUserId);
        if (contact) {
            // console.log("ChatScreen Render - contact.name:", contact.name);
            // console.log("ChatScreen Render - contact._id (chatId):", contact._id);
            // // This is the new crucial log to see the partner's ID
            // console.log("ChatScreen Render - contact.participant2Id (for simulated reply sender):", contact.participant2Id);
            // console.log("ChatScreen Render - contact.participant1Id (current user's ID in chat context):", contact.participant1Id);
        } else {
            console.warn("ChatScreen Render - contact prop is missing!");
        }
    }, [contact, currentUserId]);


    // --- Handle missing contact/chat data ---
    if (!contact || !contact._id) {
        useEffect(() => {
            if (!contact) {
                Speech.speak("Chat data is missing. Going back to chats.");
            } else if (!contact._id) {
                Speech.speak("Invalid chat ID. Going back to chats.");
            }
            navigation.goBack();
        }, []);
        return (
            <SafeAreaView style={styles.errorContainer}>
                <Text>Error: Chat data is missing or incomplete.</Text>
                <ActivityIndicator size="large" style={{ marginTop: 20 }} />
            </SafeAreaView>
        );
    }

    const chatId = contact._id;

    useEffect(() => {
        const fetchMessages = async () => {
            if (!chatId) return;

            setIsLoadingMessages(true);
            setMessageFetchError(null);
            try {
                const response = await fetch(`${API_URL}/chats/${chatId}/messages`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to fetch messages.');
                }
                const data = await response.json();
                setMessages(data);

                // --- Mark messages as read after fetching ---
                await fetch(`${API_URL}/chats/${chatId}/messages/read`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ readerId: currentUserId })
                });

            } catch (error) {
                console.error("Error fetching messages:", error);
                setMessageFetchError(error.message);
                Alert.alert("Message Error", `Failed to load messages: ${error.message}`);
            } finally {
                setIsLoadingMessages(false);
            }
        };

        const unsubscribe = navigation.addListener('focus', fetchMessages);
        if (chatId) {
            fetchMessages();
        }

        return unsubscribe;
    }, [navigation, chatId, currentUserId]); // currentUserId in deps because `readerId` depends on it.

    useEffect(() => {
        if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
        }
    }, [messages]);

    useEffect(() => {
        const onFocus = () => {
            if (isAccessibilityMode) {
                if (isLoadingMessages) {
                    Speech.speak("Loading messages.");
                    return;
                }
                if (messageFetchError) {
                    Speech.speak(`Error loading messages: ${messageFetchError}. Going back.`);
                    navigation.goBack();
                    return;
                }

                const unreadMsgs = messages.filter(m => !m.read && m.senderId !== currentUserId);

                if (unreadMsgs.length > 0) {
                    const unreadCount = unreadMsgs.length;
                    let speechOutput = `You have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''} from ${contact.name}.`;
                    unreadMsgs.forEach(msg => { speechOutput += ` ${msg.text}.`; });
                    Speech.speak(speechOutput, { onDone: startListening });
                } else {
                    const message = `Chat with ${contact.name}. You can send a message, or say 'exit chat'.`;
                    Speech.speak(message, { onDone: startListening });
                }
            }
        };
        const unsubscribe = navigation.addListener('focus', onFocus);
        return unsubscribe;
    }, [navigation, contact.name, isAccessibilityMode, messages, isLoadingMessages, messageFetchError, startListening, currentUserId]);

    useEffect(() => {
        if (!isAccessibilityMode || status !== 'idle' || !recognizedText) return;

        const lowerCaseText = recognizedText.toLowerCase();

        if (lowerCaseText.includes('exit chat') || lowerCaseText.includes('go back')) {
            Speech.speak("Exiting chat.", { onDone: () => navigation.goBack() });
        } else if (lowerCaseText.includes('exit app')) {
            Speech.speak("Goodbye!"); BackHandler.exitApp();
        } else {
            sendMessage(recognizedText);
        }
        setRecognizedText('');
    }, [recognizedText, status, isAccessibilityMode, navigation, sendMessage]);

    const sendMessage = async (text, isSimulatedReply = false) => {
        // --- Added more robust logging for sendMessage ---
        // console.log("sendMessage called:");
        // console.log("  text:", text);
        // console.log("  isSimulatedReply:", isSimulatedReply);
        // console.log("  chatId:", chatId);
        // console.log("  currentUserId (hardcoded):", currentUserId);
        // console.log("  contact.participant1Id:", contact?.participant1Id); // Log both participant IDs
        // console.log("  contact.participant2Id:", contact?.participant2Id);

        if (!text.trim() || !chatId || !currentUserId) {
            console.warn("Cannot send message: Missing text, chatId, or currentUserId.");
            Alert.alert("Error", "Unable to send message. Please ensure chat is valid and try again.");
            return;
        }

        // --- THE FIX IS HERE ---
        // Determine the senderId for the message.
        // If it's a simulated reply, the sender is the *other* participant in the chat.
        // Otherwise, it's the current user (hardcoded_user_123).
        let senderId;
        if (isSimulatedReply) {
             // If currentUserId is participant1Id, then the partner is participant2Id
             // If currentUserId is participant2Id, then the partner is participant1Id
            senderId = (currentUserId === contact.participant1Id) ? contact.participant2Id : contact.participant1Id;
            if (!senderId) {
                console.error("Critical: Partner ID is undefined for simulated reply.");
                Alert.alert("Error", "Could not identify partner for simulated reply.");
                return;
            }
        } else {
            senderId = currentUserId;
        }

        const messagePayload = { senderId, text };

        try {
            const response = await fetch(`${API_URL}/chats/${chatId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(messagePayload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to send message.');
            }

            const responseData = await response.json();
            const sentMessage = responseData.message;

            setMessages(prev => [...prev, sentMessage]);

            if (isAccessibilityMode && !isSimulatedReply) {
                Speech.speak(`You sent: ${text}`);
            }

        } catch (error) {
            console.error("Error sending message:", error);
            Speech.speak(`Failed to send message: ${error.message}.`);
            Alert.alert("Message Error", `Failed to send message: ${error.message}`);
        } finally {
            setTextInput('');
            if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: true });
            }
        }
    };

    const handleSimulatedReply = () => {
        const replyText = "This is a simulated reply";

        setTimeout(() => {
            sendMessage(replyText, true);
        }, 1500);
    };

    const handleUserSendMessage = (text) => {
        if (!text.trim()) return;
        sendMessage(text, false);
        handleSimulatedReply();
    };

    if (isLoadingMessages) {
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <ActivityIndicator size="large" color="#586eeb" />
                <Text style={{ marginTop: 10 }}>Loading messages...</Text>
                {messageFetchError && <Text style={styles.errorText}>Error: {messageFetchError}</Text>}
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.chatHeaderBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <FontAwesome name="chevron-left" size={18} color="#333" />
                </TouchableOpacity>
                <View style={styles.contactCardContainer}>
                    <Image
                        source={imageMap[contact.image] || { uri: contact.image } || require('../../assets/profileDemo.jpg')}
                        style={styles.chatHeaderImage}
                    />
                    <Text style={styles.chatHeaderTitle}>{contact.name}</Text>
                </View>
            </View>

            {/* Messages */}
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={headerHeight}
            >
                <FlatList
                    ref={flatListRef}
                    style={styles.messageList}
                    data={messages}
                    keyExtractor={(item) => item._id.toString()}
                    renderItem={({ item }) => (
                        <View style={[
                            styles.messageBubble,
                            item.senderId === currentUserId ? styles.userMessage : styles.contactMessage
                        ]}>
                            <Text style={[
                                styles.messageText,
                                { color: item.senderId === currentUserId ? '#fff' : '#000' }
                            ]}>{item.text}</Text>
                        </View>
                    )}
                    onContentSizeChange={() => flatListRef.current.scrollToEnd({ animated: true })}
                    onLayout={() => flatListRef.current.scrollToEnd({ animated: true })}
                />

                {/* Input */}
                {!isAccessibilityMode && (
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.textInput}
                            value={textInput}
                            onChangeText={setTextInput}
                            placeholder="Type a message..."
                            placeholderTextColor="#999"
                            onSubmitEditing={() => handleUserSendMessage(textInput)}
                            multiline
                        />
                        <TouchableOpacity style={styles.sendButton} onPress={() => handleUserSendMessage(textInput)}>
                            <FontAwesome name="paper-plane" size={21} color="#fff" />
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
        marginTop: 10,
    },
    chatHeaderBar: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
        gap: 5
    },
    contactCardContainer: {
        flexDirection: 'row', alignItems: 'center'
    },
    backButton: { fontSize: 30, color: '#333', marginRight: 10, fontWeight: 'bold' },
    chatHeaderImage: { width: 45, height: 45, borderRadius: 22.5 },
    chatHeaderTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: 10 },

    messageList: { flex: 1, paddingHorizontal: 15, paddingTop: 10 },
    messageBubble: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, marginVertical: 4, maxWidth: '75%' },
    userMessage: { backgroundColor: '#586eeb', alignSelf: 'flex-end' },
    contactMessage: { backgroundColor: '#f0f0f0', alignSelf: 'flex-start' },
    messageText: { fontSize: 16 },

    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 11,
    },

    textInput: {
        flex: 1,
        minHeight: 50,
        maxHeight: 100,
        backgroundColor: '#f5f5f5',
        borderRadius: 25,
        paddingHorizontal: 15,
        fontSize: 16,
        marginHorizontal: 8,
    },

    sendButton: {
        width: 46,
        height: 46,
        borderRadius: 24,
        backgroundColor: '#586eeb',
        justifyContent: 'center',
        alignItems: 'center',
    },

});

export default ChatScreen;