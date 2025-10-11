import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, FlatList,
  TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, Image, ActivityIndicator, Alert
} from 'react-native';
import * as Speech from 'expo-speech';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useAppContext } from '../context/AppContext';
import { FontAwesome } from "@expo/vector-icons";
import { useHeaderHeight } from '@react-navigation/elements';
import { imageMap } from '../utils/imageMap';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.180.131.188:3001';

const ChatScreen = ({ route, navigation }) => {
  const { conversations, setConversations, isAccessibilityMode } = useAppContext();
  const contact = route?.params?.contact;
  const headerHeight = useHeaderHeight();
  const flatListRef = useRef(null);

  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [messageFetchError, setMessageFetchError] = useState(null);
  const currentUserId = "yato";

  if (!contact) {
    useEffect(() => { navigation.goBack(); }, [navigation]);
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text>Contact data is missing.</Text>
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      </SafeAreaView>
    );
  }

  const [messages, setMessages] = useState(conversations[contact.name] || []);
  const [textInput, setTextInput] = useState('');
  const { status, recognizedText, error, startListening, stopListening, setRecognizedText } = useVoiceRecognition();
  const chatId = contact._id;

  // ✅ Fetch messages from DB
  useEffect(() => {
    const fetchMessages = async () => {
      if (!chatId) {
        setIsLoadingMessages(false);
        return;
      }

      try {
        setIsLoadingMessages(true);
        const response = await fetch(`${API_URL}/chats/${chatId}/messages`);
        if (!response.ok) throw new Error('Failed to fetch messages from database.');
        const data = await response.json();

        setConversations(prev => ({ ...prev, [contact.name]: data }));

        await fetch(`${API_URL}/chats/${chatId}/messages/read`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ readerId: currentUserId })
        });
      } catch (err) {
        setMessageFetchError(err.message);
        Alert.alert("Error", `Could not load messages: ${err.message}`);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [chatId, contact.name, setConversations]);

  useEffect(() => {
    setMessages(conversations[contact.name] || []);
  }, [conversations, contact.name]);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    setMessages(conversations[contact.name] || []);
  },[conversations[contact.name]]);

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

const sendMessage = useCallback(async (text, sender = 'user') => {
  if (!text.trim()) return;

  const newMessage = {
    id: Date.now().toString(),
    text,
    sender,
    read: sender === 'user',
    senderId: sender === 'user' ? currentUserId : contact._id,
    timestamp: new Date().toISOString(),
  };

  // Update locally
  const updatedMessages = [...(conversations[contact.name] || []), newMessage];
  setConversations(prev => ({ ...prev, [contact.name]: updatedMessages }));
  if (sender === 'user') setTextInput('');

  try {
    await fetch(`${API_URL}/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: newMessage.senderId,
        text: newMessage.text,
        timestamp: newMessage.timestamp,
      }),
    });
  } catch (err) {
    console.error('Error saving message to DB:', err);
  }
}, [conversations, contact.name, setConversations, chatId, currentUserId, contact._id]);


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

  // Send user message
  sendMessage(recognizedText, 'user');
  Speech.speak(`You said: ${recognizedText}`, {
    onDone: () => {
      setTimeout(() => {
        const replyText = `This is a simulated reply.`;
        sendMessage(replyText, contact.name);

        // Speak the reply, then start listening again silently
        Speech.speak(`New message from ${contact.name}: ${replyText}`, {
          onDone: () => {
            // Start listening again WITHOUT repeating "Say your message..."
            setTimeout(() => startListening(), 500);
          }
        });
      }, 1000);
    }
  });

  setRecognizedText('');
}, [recognizedText, status, isAccessibilityMode]);

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
          renderItem={({ item }) => (
            <View style={[
              styles.messageBubble,
              item.sender === 'user' || item.senderId === currentUserId
                ? styles.userMessage
                : styles.contactMessage
            ]}>
              <Text style={{
                color: item.sender === 'user' || item.senderId === currentUserId ? '#fff' : '#000'
              }}>
                {item.text}
              </Text>
            </View>
          )}
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
});

export default ChatScreen;
