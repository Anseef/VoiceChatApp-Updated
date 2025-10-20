import React, { useState, useEffect } from 'react'; // Removed useCallback as it's not needed
import {
    SafeAreaView, View, Text, StyleSheet, ScrollView,
    TouchableOpacity, ActivityIndicator, Platform
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { FontAwesome } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';

const helpContent = [
    {
        title: "Getting Started",
        text: "Welcome to Echo-Brigde, To start a new chat, say 'Add new chat' on the main chat list screen. To navigate, use commands like 'Go back' or 'Go to profile'."
    },
    {
        title: "Sending Messages",
        text: "In any chat, you can simply speak your message. The app will automatically transcribe and send it. If you make a mistake, say 'Delete last message' to remove your last sent message."
    },
    {
        title: "Navigating Chats",
        text: "On the main chat screen, you can say the name of a contact to open their chat. To return to the main list from a chat, say 'Exit chat' or 'Go back'."
    },
    {
        title: "Accessibility Mode",
        text: "Accessibility mode provides voice guidance and hands-free interaction. Toggle it on or off in the app settings, which can be found via the profile screen."
    }
];

const HelpCenterScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const { isAccessibilityMode } = useAppContext();
    const { status, recognizedText, startListening, setRecognizedText, error } = useVoiceRecognition();

    const [isSpeaking, setIsSpeaking] = useState(false);
    // ✅ State to reliably trigger a re-run of the speech sequence
    const [sequenceId, setSequenceId] = useState(0);

    // ✅ Main Speech Engine
    useEffect(() => {
        if (!isFocused || !isAccessibilityMode) {
            Speech.stop();
            return;
        }

        let isCancelled = false;

        const speakSequence = (index) => {
            if (isCancelled || index >= helpContent.length) {
                if (!isCancelled) {
                    setIsSpeaking(false);
                    startListening();
                }
                return;
            }
            
            const item = helpContent[index];
            const fullText = `Topic: ${item.title}. ${item.text}.`;
            
            Speech.speak(fullText, {
                onDone: () => speakSequence(index + 1),
                onError: () => {
                    if (!isCancelled) {
                        setIsSpeaking(false);
                        startListening();
                    }
                },
            });
        };
        
        const introMessage = "You are on the Help Center. I will now read the help topics. You can say 'go back' or 'repeat'.";
        
        const speakTimeout = setTimeout(() => {
            if (isCancelled) return;
            setIsSpeaking(true);
            Speech.speak(introMessage, {
                onDone: () => speakSequence(0),
                onError: () => {
                    if (!isCancelled) {
                        setIsSpeaking(false);
                        startListening();
                    }
                }
            });
        }, 300);

        return () => {
            isCancelled = true;
            clearTimeout(speakTimeout);
            Speech.stop();
        };
        // ✅ The effect now re-runs when `sequenceId` changes
    }, [isFocused, isAccessibilityMode, sequenceId]);

    // ✅ Voice Command Handling
    useEffect(() => {
        if (!isFocused || !isAccessibilityMode || status !== 'idle' || !recognizedText || isSpeaking) {
            return;
        }
        
        const lower = recognizedText.toLowerCase().trim();
        setRecognizedText('');

        if (lower.includes('go back') || lower.includes('exit')) {
            Speech.speak("Going back to the profile screen.", {
                onDone: () => navigation.goBack()
            });
        } else if (lower.includes('repeat')) {
            // ✅ CORRECTION: Use the state trigger instead of the navigation trick
            Speech.speak("Repeating the help topics.", {
                onDone: () => {
                    // Incrementing the ID will reliably re-trigger the main effect
                    setSequenceId(id => id + 1);
                }
            });
        } else {
            Speech.speak("Sorry, I didn't understand. You can say 'go back' or 'repeat'.", {
                onDone: () => {
                    if (!isSpeaking) {
                        setTimeout(() => startListening(), 300);
                    }
                }
            });
        }
    }, [recognizedText, status, isFocused]); 


    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <FontAwesome name="chevron-left" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Help Center</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollViewContent}>
                {helpContent.map((item, index) => (
                    <View key={index} style={styles.helpItem}>
                        <Text style={styles.itemTitle}>{item.title}</Text>
                        <Text style={styles.itemText}>{item.text}</Text>
                    </View>
                ))}
            </ScrollView>

            {isAccessibilityMode && status === 'listening' && !isSpeaking && (
                <View style={styles.listeningIndicatorContainer}>
                    <ActivityIndicator size="small" color="#586eeb" />
                    <Text style={styles.listeningIndicatorText}>Listening for your command...</Text>
                </View>
            )}
            {isAccessibilityMode && error && (
                <View style={styles.listeningIndicatorContainer}>
                    <Text style={styles.errorTextSmall}>Voice error: {error}</Text>
                </View>
            )}
        </SafeAreaView>
    );
};

// Styles remain the same
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
    backButton: { marginRight: 15, padding: 5 },
    headerTitle: { fontSize: 22, fontWeight: 'bold' },
    scrollViewContent: {
        padding: 20,
    },
    helpItem: {
        marginBottom: 20,
        backgroundColor: '#f9f9f9',
        borderRadius: 10,
        padding: 15,
        borderWidth: 1,
        borderColor: '#eee',
    },
    itemTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#333',
    },
    itemText: {
        fontSize: 16,
        lineHeight: 24,
        color: '#555',
    },
    listeningIndicatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        backgroundColor: '#fff',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    listeningIndicatorText: {
        marginLeft: 10,
        fontSize: 16,
        color: '#586eeb',
    },
    errorTextSmall: {
        color: 'red',
        fontSize: 14,
        textAlign: 'center',
    },
});

export default HelpCenterScreen;