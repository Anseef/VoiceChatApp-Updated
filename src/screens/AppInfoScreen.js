import React, { useState, useEffect } from 'react';
import {
    SafeAreaView, View, Text, StyleSheet, TouchableOpacity,
    Platform, ActivityIndicator, Image
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { FontAwesome } from '@expo/vector-icons';
// import * as Application from 'expo-application';
import { useAppContext } from '../context/AppContext';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';

const AppInfoScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const { isAccessibilityMode } = useAppContext();
    const { status, recognizedText, startListening, setRecognizedText, error } = useVoiceRecognition();

    const [isSpeaking, setIsSpeaking] = useState(false);
    // const [appVersion, setAppVersion] = useState('1.0.0');

    // ✅ Effect 1: Main Screen Logic (Pattern from ProfileScreen)
    useEffect(() => {
        if (!isFocused || !isAccessibilityMode) {
            Speech.stop();
            return;
        }

        let isCancelled = false; // Flag to prevent updates after unmount

        const fetchAndGreet = async () => {
            try {
                let version = '1.0.0';
                if (Platform.OS === 'ios' || Platform.OS === 'android') {
                    version = '1.0.0';
                }

                if (isCancelled) return;
                // setAppVersion(version);

                const speechText = `You are on the App Information screen. The app name is EchoBrigde, and the version is ${version}. Say 'go back' to return to the profile screen.`;

                setIsSpeaking(true);
                Speech.speak(speechText, {
                    onDone: () => {
                        if (!isCancelled) {
                            setIsSpeaking(false);
                            startListening();
                        }
                    },
                    onError: (e) => {
                        console.error("Speech error in AppInfo greeting:", e);
                        if (!isCancelled) {
                            setIsSpeaking(false);
                            startListening();
                        }
                    }
                });

            } catch (err) {
                console.error("Failed to fetch app version:", err);
                if (!isCancelled) {
                    setIsSpeaking(false);
                    startListening();
                }
            }
        };
        
        // A small delay ensures screen transitions are smooth
        const timeoutId = setTimeout(fetchAndGreet, 300);

        // Cleanup function
        return () => {
            isCancelled = true;
            clearTimeout(timeoutId);
            Speech.stop();
        };
    }, [isFocused, isAccessibilityMode]);


    // ✅ Effect 2: Voice Command Handling
    useEffect(() => {
        // This guard clause prevents the effect from running while speaking
        if (!isFocused || !isAccessibilityMode || status !== 'idle' || !recognizedText || isSpeaking) {
            return;
        }

        const lower = recognizedText.toLowerCase().trim();
        setRecognizedText('');

        if (lower.includes('go back') || lower.includes('return')) {
            Speech.speak("Going back to the profile screen.", {
                onDone: () => navigation.goBack()
            });
        } else {
            Speech.speak("Sorry, I didn't understand that. You can say 'go back'.", {
                onDone: () => {
                    if (!isSpeaking) {
                        setTimeout(() => startListening(), 300);
                    }
                }
            });
        }
    // This dependency array is correct and won't cause loops
    }, [recognizedText, status, isFocused, navigation, setRecognizedText, startListening]);


    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <FontAwesome name="chevron-left" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>App Info</Text>
            </View>

            <View style={styles.content}>
                <Image
                    source={require('../../assets/LogoMain.png')}
                    style={styles.appIcon}
                />
                <Text style={styles.appName}>Echo-Brigde</Text>
                <Text style={styles.appVersion}>Version: 1.0.0</Text>
            </View>

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
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    appIcon: {
        width: 100,
        height: 100,
        borderRadius: 20,
        marginBottom: 20,
    },
    appName: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    appVersion: {
        fontSize: 18,
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

export default AppInfoScreen;