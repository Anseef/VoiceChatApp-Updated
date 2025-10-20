import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, FlatList,
  TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, Image, ActivityIndicator, Alert, Modal
} from 'react-native';
import { Menu, MenuOptions, MenuOption, MenuTrigger } from 'react-native-popup-menu';
import * as Speech from 'expo-speech';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useAppContext } from '../context/AppContext';
import { FontAwesome } from "@expo/vector-icons";
import { useHeaderHeight } from '@react-navigation/elements';
import { imageMap } from '../utils/imageMap';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.180.131.188:3001';

const ChatScreen = ({ route, navigation }) => {
  const { conversations, setConversations, isAccessibilityMode, currentUser } = useAppContext();
  const contact = route?.params?.contact;
  const headerHeight = useHeaderHeight();
  const flatListRef = useRef(null);

  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [messageFetchError, setMessageFetchError] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [textInput, setTextInput] = useState('');
  const { status, recognizedText, error, startListening, stopListening, setRecognizedText } = useVoiceRecognition();
  
  const currentUserId = currentUser?._id;
  const chatId = contact?._id;

  if (!contact) {
    useEffect(() => { navigation.goBack(); }, [navigation]);
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text>Contact data is missing.</Text>
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      </SafeAreaView>
    );
  }

  const messages = conversations[contact.name] || [];

  // Fetch messages from DB
  useEffect(() => {
    const fetchMessages = async () => {
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
  }, [chatId, currentUserId, contact.name, setConversations]);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // Accessibility speech handling
  useEffect(() => {
    if (!isAccessibilityMode || isLoadingMessages) return;

    Speech.stop();
    const currentMsgs = conversations[contact.name] || [];
    const unreadMsgs = currentMsgs.filter(
      m => !m.read && m.senderId !== currentUserId
    );

    let speechOutput = '';

    if (unreadMsgs.length > 0) {
      speechOutput = `You have ${unreadMsgs.length} unread message${unreadMsgs.length > 1 ? 's' : ''} from ${contact.name}. `;
      unreadMsgs.forEach(msg => { speechOutput += `${msg.text}. `; });
    } else {
      speechOutput = `You are now chatting with ${contact.name}. `;
    }
    // Speech.speak(speechOutput + "Say your message, say 'start call', or say 'exit chat'.", {
    Speech.speak(speechOutput + "Say your message, or say 'exit chat'.", {
      onDone: () => {
        startListening();
      },
    });

    const updatedMsgs = currentMsgs.map(m => ({ ...m, read: true }));
    setConversations(prev => ({ ...prev, [contact.name]: updatedMsgs }));

  }, [isAccessibilityMode, isLoadingMessages]);

  const sendMessage = useCallback(async (text, senderName) => {
    if (!text.trim() || !chatId || !currentUserId) {
      console.warn("Cannot send message: Missing text, chatId, or currentUserId.");
      return;
    }

    const newMessage = {
      id: Date.now().toString(),
      text,
      sender: senderName,
      read: senderName === 'user',
      senderId: senderName === 'user' ? currentUserId : contact._id,
      timestamp: new Date().toISOString(),
    };

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
          createdAt: newMessage.timestamp,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send message to database.");
      }
    } catch (err) {
      console.error('Error saving message to DB:', err);
      Alert.alert("Error", `Failed to send message: ${err.message}`);
    }
  }, [contact.name, setConversations, chatId, currentUserId, contact._id]);

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

  // Handle voice commands
  useEffect(() => {
    if (!isAccessibilityMode || status !== 'idle' || !recognizedText) return;

    const lower = recognizedText.toLowerCase().trim();
    if (!lower) return setRecognizedText('');

    Speech.stop();
    setRecognizedText(''); // Clear text immediately

    // if (lower.includes('start call') || lower.includes('call contact')) {
    //   Speech.speak(`Calling ${contact.name}`, {
    //     onDone: () => navigation.navigate('Call', { contact })
    //   });
    //   return;
    // }

    if (lower.includes('exit chat') || lower.includes('go back')) {
      Speech.speak("Exiting chat.", { onDone: () => navigation.navigate('Home') });
      return;
    }

    if (lower.includes('delete last message')) {
      deleteLastUserMessage(true);
      return;
    }

    sendMessage(recognizedText, 'user');
    Speech.speak(`You said: ${recognizedText}`, {
      onDone: () => {
        setTimeout(() => {
          const replyText = `This is a simulated reply.`;
          sendMessage(replyText, contact.name);

          Speech.speak(`New message from ${contact.name}: ${replyText}`, {
            onDone: () => {
              setTimeout(() => startListening(), 500);
            }
          });
        }, 1000);
      }
    });
  }, [recognizedText, status, isAccessibilityMode, sendMessage, contact, navigation, startListening, setRecognizedText, deleteLastUserMessage]);

  const handleUserSendMessage = (text) => {
    if (!text.trim()) return;
    sendMessage(text, 'user');
    setTimeout(() => {
      const reply = `This is a simulated reply.`;
      sendMessage(reply, contact.name);
    }, 1500);
  };

  // const handleStartCall = () => {
  //   navigation.navigate('Call', { contact });
  // };

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
      <Modal
        animationType="fade"
        transparent={true}
        visible={isDeleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Delete Message</Text>
            <Text style={styles.modalText}>Are you sure you want to delete your last message? This action cannot be undone.</Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={() => {
                  deleteLastUserMessage(false);
                  setDeleteModalVisible(false);
                }}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.chatHeaderBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <FontAwesome name="chevron-left" size={18} color="#333" />
        </TouchableOpacity>
        <Image
          source={imageMap[contact.image] || { uri: contact.image }}
          style={styles.chatHeaderImage}
        />
        <Text style={styles.chatHeaderTitle}>{contact.name}</Text>
        
        {/* {!isAccessibilityMode && (
          <TouchableOpacity onPress={handleStartCall} style={styles.callButton}>
            <FontAwesome name="phone" size={24} color="#586eeb" />
          </TouchableOpacity>
        )} */}
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
          contentContainerStyle={{ paddingBottom: 10 }}
          renderItem={({ item }) => {
            const isUserMessage = item.senderId === currentUserId;

            if (isUserMessage && !isAccessibilityMode) {
              return (
                <Menu>
                  <MenuTrigger triggerOnLongPress>
                    <View
                      style={[styles.messageBubble, styles.userMessage]}
                    >
                      <Text style={styles.messageTextUser}>{item.text}</Text>
                    </View>
                  </MenuTrigger>
                  <MenuOptions customStyles={{ optionsContainer: { borderRadius: 12, padding: 5, marginTop: 45, shadowOpacity: 0.1 } }}>
                    <MenuOption onSelect={() => setDeleteModalVisible(true)}>
                      <View style={styles.menuOption}>
                        <FontAwesome name="trash-o" size={20} color="#d9534f" />
                        <Text style={styles.menuOptionText}>Delete Message</Text>
                      </View>
                    </MenuOption>
                  </MenuOptions>
                </Menu>
              );
            }

            return (
              <View style={[styles.messageBubble, isUserMessage ? styles.userMessage : styles.contactMessage]}>
                <Text style={isUserMessage ? styles.messageTextUser : styles.messageTextContact}>{item.text}</Text>
              </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  backButton: { padding: 5, marginRight: 10 },
  chatHeaderImage: { width: 45, height: 45, borderRadius: 22.5 },
  chatHeaderTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10
  },
  callButton: {
    padding: 10,
    marginLeft: 10,
  },
  messageList: { flex: 1, paddingHorizontal: 15, paddingTop: 10 },
  messageBubble: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginVertical: 4,
    maxWidth: '75%'
  },
  userMessage: { backgroundColor: '#586eeb', alignSelf: 'flex-end' },
  contactMessage: { backgroundColor: '#f0f0f0', alignSelf: 'flex-start' },
  messageTextUser: { color: '#fff' },
  messageTextContact: { color: '#000' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0'
  },
  textInput: {
    flex: 1,
    minHeight: 45,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingHorizontal: 15,
    fontSize: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 0,
    paddingBottom: Platform.OS === 'ios' ? 12 : 0
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 24,
    backgroundColor: '#586eeb',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8
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
  },
  menuOption: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  menuOptionText: { marginLeft: 12, fontSize: 16, color: '#d9534f' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '85%',
  },
  modalTitle: {
    marginBottom: 10,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  modalText: {
    marginBottom: 25,
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 12,
    elevation: 2,
    flex: 1,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#E2E8F0',
  },
  deleteButton: {
    backgroundColor: '#E53E3E',
  },
  cancelButtonText: {
    color: '#2D3748',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  }
});

export default ChatScreen;