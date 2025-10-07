// AddChatScreen.js

import React, { useState, useEffect } from 'react';
import {
    SafeAreaView, View, Text, StyleSheet, FlatList,
    ActivityIndicator, TouchableOpacity, Alert, Platform,
    Image // <--- ADD THIS IMPORT!
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { useNavigation } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { useAppContext } from '../context/AppContext';
import { FontAwesome } from '@expo/vector-icons';
// import { imageMap } from '../utils/imageMap'; // Assuming this exists

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.180.131.188:3001';

const AddChatScreen = () => {
    const navigation = useNavigation();
    const { isAccessibilityMode } = useAppContext();

    const [phoneContacts, setPhoneContacts] = useState([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(true);
    const [isLoading, setIsLoading] = useState(false); // For chat initiation
    const [fetchError, setFetchError] = useState(null);

    // Hardcoded user for now
    const currentUserId = "yato";
    const currentUserName = "You"; // Or another default name

    useEffect(() => {
        const loadContacts = async () => {
            setIsLoadingContacts(true);
            try {
                const { status: permissionStatus } = await Contacts.requestPermissionsAsync();

                if (permissionStatus === 'granted') {
                    const { data } = await Contacts.getContactsAsync({
                        fields: [Contacts.Fields.Emails, Contacts.Fields.Image], // Requesting image also
                    });

                    if (data.length > 0) {
                        const sortedContacts = data
                            .filter(c => c.name && c.id) // Ensure name and ID exist
                            .sort((a, b) => a.name.localeCompare(b.name));
                        setPhoneContacts(sortedContacts);
                        // console.log("AddChatScreen: Fetched Phone Contacts (first 5 with IDs):", sortedContacts.slice(0, 5).map(c => ({ id: c.id, name: c.name })));
                    } else {
                        console.log("No contacts found.");
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

        loadContacts();
    }, []);

    const initiateChat = async (contact) => { // This `contact` is the phone contact object from `expo-contacts`
        setIsLoading(true);
        Speech.speak(`Attempting to start chat with ${contact.name}`);
        // console.log("AddChatScreen: initiateChat called with phone contact:", { id: contact.id, name: contact.name });


        try {
            const response = await fetch(`${API_URL}/chats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    senderId: currentUserId,
                    senderName: currentUserName, // Make sure this is defined
                    partnerId: contact.id, // This is the phone contact's ID
                    partnerName: contact.name,
                    partnerImage: contact.imageAvailable && contact.image.uri ? contact.image.uri : null,
                }),
            });

            const requestBody = {
                senderId: currentUserId,
                senderName: currentUserName,
                partnerId: contact.id,
                partnerName: contact.name,
                partnerImage: contact.imageAvailable && contact.image.uri ? contact.image.uri : null,
            };
            // console.log("AddChatScreen: Request body sent to backend:", JSON.stringify(requestBody));


            if (!response.ok && response.status !== 200) { // 200 is for existing chat
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create chat.');
            }

            const responseData = await response.json();
            const newChat = responseData.chat; // This `newChat` object is from your backend

            // console.log("AddChatScreen: Backend response newChat object:", newChat);

            Speech.speak(`Chat opened with ${newChat.name}.`);
            navigation.navigate('Chat', {
                contact: { // This `contact` object is what ChatScreen receives
                    _id: newChat._id,
                    name: newChat.name,
                    participant1Id: newChat.participant1Id,
                    participant2Id: newChat.participant2Id,
                    image: newChat.image || 'profileDemo.jpg',
                    lastMessage: newChat.lastMessage,
                    time: newChat.time,
                    unread: newChat.unread,
                }
            });

        } catch (error) {
            console.error("Error initiating chat:", error);
            Speech.speak(`Failed to start chat with ${contact.name}: ${error.message}.`);
            Alert.alert("Chat Error", `Failed to start chat with ${contact.name}: ${error.message}`);
            setFetchError(`Failed to start chat: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };
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
                    <TouchableOpacity style={styles.retryButton} onPress={() => {/* re-attempt loadContacts or goBack */ }}>
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
                            onPress={() => initiateChat(item)} // Pass the full contact item from expo-contacts
                            disabled={isLoading}
                        >
                            <Image
                                source={item.imageAvailable && item.image.uri
                                    ? { uri: item.image.uri }
                                    : require('../../assets/profileDemo.jpg')} // Default image
                                style={styles.contactImage}
                            />
                            <Text style={styles.contactName}>{item.name}</Text>
                            {isLoading && (
                                <View style={styles.loadingOverlay}>
                                    <ActivityIndicator size="small" color="#586eeb" />
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                />
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
        paddingTop: 50,
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
        position: 'relative', // For loading overlay
    },
    contactImage: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
    contactName: { fontSize: 15, fontWeight: '500' },
    loadingOverlay: {
        position: 'absolute',
        top: 0, bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(255,255,255,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});

export default AddChatScreen;