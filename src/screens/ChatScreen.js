import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, FlatList,
  TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, Image, ActivityIndicator, Alert
} from 'react-native';
import * as Speech from 'expo-speech';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useAppContext } from '../context/AppContext'; // Ensure this path is correct
import { FontAwesome } from "@expo/vector-icons";
import { useHeaderHeight } from '@react-navigation/elements';
import { imageMap } from '../utils/imageMap';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.180.131.188:3001';

const ChatScreen = ({ route, navigation }) => {
  // Destructure currentUser from useAppContext
  const { conversations, setConversations, isAccessibilityMode, currentUser } = useAppContext();
  const contact = route?.params?.contact;
  const headerHeight = useHeaderHeight();
  const flatListRef = useRef(null);

  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [messageFetchError, setMessageFetchError] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false); // <-- ADD THIS LINE

  // Use the actual current user's ID
  const currentUserId = currentUser?._id; // Access currentUser from context

  if (!contact) {
    useEffect(() => { navigation.goBack(); }, [navigation]);
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text>Contact data is missing.</Text>
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      </SafeAreaView>
    );
  }

  // const [messages, setMessages] = useState(conversations[contact.name] || []);

  const messages = conversations[contact.name] || [];
  const [textInput, setTextInput] = useState('');
  const { status, recognizedText, error, startListening, stopListening, setRecognizedText } = useVoiceRecognition();
  const chatId = contact._id;

  // ✅ Fetch messages from DB
  useEffect(() => {
    const fetchMessages = async () => {
      // Ensure we have a chatId and currentUserId before fetching
      if (!chatId || !currentUserId) {
        console.warn("ChatScreen: Missing chatId or currentUserId. Skipping message fetch.");
        setIsLoadingMessages(false);
        return;
      }

      try {
        setIsLoadingMessages(true);
        const response = await fetch(`${API_URL}/chats/${chatId}/messages`);
        if (!response.ok) throw new Error('Failed to fetch messages from database.');
        const data = await response.json();

        setConversations(prev => ({ ...prev, [contact.name]: data }));

        // Mark messages as read by the current user
        await fetch(`${API_URL}/chats/${chatId}/messages/read`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ readerId: currentUserId }) // Use currentUserId here
        });
      } catch (err) {
        setMessageFetchError(err.message);
        Alert.alert("Error", `Could not load messages: ${err.message}`);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [chatId, currentUserId, contact.name, setConversations]); // Add currentUserId to dependency array

  // useEffect(() => {
  //   setMessages(conversations[contact.name] || []);
  // }, [conversations, contact.name]);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // useEffect(() => {
  //   // This useEffect is redundant with the previous one, you can combine or remove this.
  //   // setMessages(conversations[contact.name] || []);
  // }, [conversations[contact.name]]);

  useEffect(() => {
    if (!isAccessibilityMode || isLoadingMessages) return;

    Speech.stop();
    const currentMsgs = conversations[contact.name] || [];
    const unreadMsgs = currentMsgs.filter(
      m => !m.read && m.sender !== 'user' && m.senderId !== currentUserId
    );

    let speechOutput = '';

    if (unreadMsgs.length > 0) {
      speechOutput = `You have ${unreadMsgs.length} unread message${unreadMsgs.length > 1 ? 's' : ''} from ${contact.name}. `;
      unreadMsgs.forEach(msg => { speechOutput += `${msg.text}. `; });
    } else {
      speechOutput = `You are now chatting with ${contact.name}. `;
    }
    Speech.speak(speechOutput + "Say your message or say exit chat.", {
      onDone: () => {
        startListening();
      },
    });

    // Mark as read
    const updatedMsgs = currentMsgs.map(m => ({ ...m, read: true }));
    setConversations(prev => ({ ...prev, [contact.name]: updatedMsgs }));
    
  }, [isAccessibilityMode, isLoadingMessages]);

  const sendMessage = useCallback(async (text, senderName) => { // Renamed sender to senderName for clarity
    if (!text.trim() || !chatId || !currentUserId) { // Ensure currentUserId exists
        console.warn("Cannot send message: Missing text, chatId, or currentUserId.");
        return;
    }

    const newMessage = {
      id: Date.now().toString(), // Client-side ID for immediate display
      text,
      sender: senderName, // This `sender` field is for UI display (e.g., 'user' or contact.name)
      read: senderName === 'user',
      senderId: senderName === 'user' ? currentUserId : contact._id, // This is the ID stored in DB
      timestamp: new Date().toISOString(),
    };

    // Optimistic UI update: Add message locally first
    // const updatedMessages = [...(conversations[contact.name] || []), newMessage];
    // setConversations(prev => ({ ...prev, [contact.name]: updatedMessages }));

    setConversations(prevConversations => {
      const currentChatMessages = prevConversations[contact.name] || [];
      const updatedMessages = [...currentChatMessages, newMessage];
      return {
        ...prevConversations,
        [contact.name]: updatedMessages
      };
    });

    if (senderName === 'user') setTextInput('');

    try {
      const response = await fetch(`${API_URL}/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chatId,
          senderId: newMessage.senderId,
          text: newMessage.text,
          createdAt: newMessage.timestamp, // Backend expects createdAt
        }),
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to send message to database.");
      }
      // Optionally refetch messages after successful send to get the server-assigned _id and exact timestamp
      // Or just rely on the optimistic update for now. For simplicity, we'll keep it optimistic.
    } catch (err) {
      console.error('Error saving message to DB:', err);
      Alert.alert("Error", `Failed to send message: ${err.message}`);
      // Revert optimistic update if send fails, or show error state for this message
    }
  }, [conversations, contact.name, setConversations, chatId, currentUserId, contact._id]);


  const deleteLastUserMessage = useCallback(async (isVoiceCommand = false) => {
    if (!chatId || !currentUserId) {
      const message = "Cannot delete message. Information is missing.";
      if (isVoiceCommand) {
        Speech.speak(message, { onDone: () => isAccessibilityMode && startListening() });
      } else {
        Alert.alert("Error", message);
      }
      return;
    }

    const currentChatMessages = conversations[contact.name] || [];
    const lastUserMessageIndex = currentChatMessages.findLastIndex(
      m => m.senderId === currentUserId
    );

    if (lastUserMessageIndex === -1) {
      const message = "There are no messages from you to delete.";
      if (isVoiceCommand) {
        Speech.speak(message, { onDone: () => isAccessibilityMode && startListening() });
      } else {
        Alert.alert("No Message", message);
      }
      return;
    }

    if (isVoiceCommand) setIsSpeaking(true);

    try {
      const response = await fetch(`${API_URL}/chats/${chatId}/messages/last/${currentUserId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete message.");
      }

      setConversations(prev => {
        const updatedMessages = [...(prev[contact.name] || [])];
        updatedMessages.splice(lastUserMessageIndex, 1);
        return { ...prev, [contact.name]: updatedMessages };
      });

      if (isVoiceCommand) {
        Speech.speak("Your last message has been deleted.", {
          onDone: () => {
            setIsSpeaking(false);
            if (isAccessibilityMode) startListening();
          }
        });
      }
    } catch (err) {
      console.error('Error deleting last message:', err);
      const message = `Failed to delete message: ${err.message}.`;
      if (isVoiceCommand) {
        Speech.speak(message, {
          onDone: () => {
            setIsSpeaking(false);
            if (isAccessibilityMode) startListening();
          }
        });
      } else {
        Alert.alert("Error", message);
      }
    }
  }, [chatId, currentUserId, conversations, contact.name, setConversations, isAccessibilityMode, startListening]);

  const handleLongPressMessage = (message) => {
    // Only allow deletion if accessibility is OFF and it's the user's own message
    if (isAccessibilityMode || message.senderId !== currentUserId) {
      return;
    }

    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete your last message?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          // Call the delete function, passing false for isVoiceCommand
          onPress: () => deleteLastUserMessage(false)
        }
      ]
    );
  };


  // ✅ Handle voice commands cleanly
  useEffect(() => {
    if (!isAccessibilityMode || status !== 'idle' || !recognizedText) return;

    const lower = recognizedText.toLowerCase().trim();
    if (!lower) return setRecognizedText('');

    Speech.stop();

    if (lower.includes('exit chat') || lower.includes('go back')) {
      Speech.speak("Exiting chat.", { onDone: () => navigation.goBack() });
      setRecognizedText('');
      return;
    }

    if (lower.includes('delete last message')) {
      setRecognizedText(''); 
      // deleteLastUserMessage();
      deleteLastUserMessage(true); 
      return;
    }

    sendMessage(recognizedText, 'user');
    Speech.speak(`You said: ${recognizedText}`, {
      onDone: () => {
        setTimeout(() => {
          const replyText = `This is a simulated reply.`;
          sendMessage(replyText, contact.name);

          // Speak the reply, then start listening again silently
          Speech.speak(`New message from ${contact.name}: ${replyText}`, {
            onDone: () => {
              setTimeout(() => startListening(), 500);
            }
          });
        }, 1000);
      }
    });

    setRecognizedText('');
  }, [recognizedText, status, isAccessibilityMode, sendMessage, contact.name, navigation, startListening, setRecognizedText]); // Added sendMessage to deps

  const handleUserSendMessage = (text) => {
    if (!text.trim()) return;
    sendMessage(text, 'user');
    setTimeout(() => {
      const reply = `This is a simulated reply.`;
      sendMessage(reply, contact.name);
    }, 1500);
  };

  if (isLoadingMessages) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <ActivityIndicator size="large" color="#586eeb" />
        <Text style={{ marginTop: 10 }}>Loading Messages...</Text>
      </SafeAreaView>
    );
  }

  if (!currentUserId) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>User not logged in. Please log in to view chats.</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Auth')}>
            <Text style={styles.loginLink}>Go to Login</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.chatHeaderBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <FontAwesome name="chevron-left" size={18} color="#333" />
        </TouchableOpacity>
        <Image
          source={imageMap[contact.image] || { uri: contact.image }}
          style={styles.chatHeaderImage}
        />
        <Text style={styles.chatHeaderTitle}>{contact.name}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight}
      >
        <FlatList
          ref={flatListRef}
          style={styles.messageList}
          data={messages}
          keyExtractor={(item) => (item.id || item._id).toString()}
          renderItem={({ item }) => {
            const isUserMessage = item.sender === 'user' || item.senderId === currentUserId;

            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={() => handleLongPressMessage(item)}
                disabled={!isUserMessage || isAccessibilityMode}
              >
                <View style={[
                  styles.messageBubble,
                  isUserMessage ? styles.userMessage : styles.contactMessage
                ]}>
                  <Text style={{ color: isUserMessage ? '#fff' : '#000' }}>
                    {item.text}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        {!isAccessibilityMode && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Type a message..."
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
  chatHeaderBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0'
  },
  backButton: { padding: 5, marginRight: 10 },
  chatHeaderImage: { width: 45, height: 45, borderRadius: 22.5 },
  chatHeaderTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: 10 },
  messageList: { flex: 1, paddingHorizontal: 15, paddingTop: 10 },
  messageBubble: {
    paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20,
    marginVertical: 4, maxWidth: '75%'
  },
  userMessage: { backgroundColor: '#586eeb', alignSelf: 'flex-end' },
  contactMessage: { backgroundColor: '#f0f0f0', alignSelf: 'flex-start' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    padding: 11, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#f0f0f0'
  },
  textInput: {
    flex: 1, minHeight: 45, maxHeight: 100,
    backgroundColor: '#f5f5f5', borderRadius: 25,
    paddingHorizontal: 15, fontSize: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 0,
    paddingBottom: Platform.OS === 'ios' ? 12 : 0
  },
  sendButton: {
    width: 46, height: 46, borderRadius: 24,
    backgroundColor: '#586eeb', justifyContent: 'center',
    alignItems: 'center', marginLeft: 8
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  loginLink: {
    color: '#586eeb',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default ChatScreen;