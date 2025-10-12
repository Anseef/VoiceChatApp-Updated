import React, { useEffect, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useAppContext } from '../context/AppContext';
import { FontAwesome } from "@expo/vector-icons";
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import * as Speech from 'expo-speech';

const SettingsIcon = ({ color = '#000', size = 24 }) => (
    <FontAwesome name="cog" size={size} color={color} />
);
const HelpIcon = ({ color = '#000', size = 24 }) => (
    <FontAwesome name="question-circle" size={size} color={color} />
);
const LogoutIcon = ({ color = '#000', size = 24 }) => (
    <FontAwesome name="sign-out" size={size} color={color} />
);

const ProfileScreen = ({ navigation }) => {
    const { isAccessibilityMode, setIsAuthenticated, currentUser } = useAppContext();
    const { status, recognizedText, error, startListening, setRecognizedText } = useVoiceRecognition();
    const isFocused = useIsFocused();

    const handleLogout = useCallback(() => setIsAuthenticated(false), [setIsAuthenticated]);

    // ✅ This hook now correctly waits for the screen to be focused AND in accessibility mode.
    useEffect(() => {
        if (isFocused && isAccessibilityMode) {
            Speech.speak(
                "You are on the profile screen. Say 'go to chats', 'go to settings', 'go to help center', or 'log out'.",
                { onDone: startListening }
            );
        }
        // Cleanup function to stop speech when the screen loses focus
        return () => {
            Speech.stop();
        };
    }, [isAccessibilityMode, isFocused]);

    // ✅ This hook processes the voice commands, also gated by the same reliable conditions.
    useEffect(() => {
        // Guard clause: Do nothing if the screen is not focused or not in accessibility mode.
        if (!isFocused || !isAccessibilityMode) return;
        // Guard clause: Only proceed if there is a new, recognized command.
        if (status !== 'idle' || !recognizedText) return;

        const lowerCaseText = recognizedText.toLowerCase();

        if (lowerCaseText.includes('go to chatscreen') || lowerCaseText.includes('go back')) {
            Speech.speak("Navigating to chats.", { onDone: () => navigation.navigate('Chats') });
        } else if (lowerCaseText.includes('go to settings')) {
            Speech.speak("Navigating to settings.", { onDone: () => console.log('Navigate to Settings') });
        } else if (lowerCaseText.includes('go to help center')) {
            Speech.speak("Navigating to help center.", { onDone: () => console.log('Navigate to Help Center') });
        } else if (lowerCaseText.includes('log out')) {
            Speech.speak("Logging you out. Goodbye!", { onDone: handleLogout });
        } else {
            Speech.speak("Sorry, I didn't understand that command. Please try again.", { onDone: startListening });
        }

        setRecognizedText(''); // Reset the text after processing
    }, [recognizedText, status, isAccessibilityMode, isFocused, navigation, startListening, handleLogout, setRecognizedText]);


    const ProfileOption = ({ icon, text, onPress }) => (
        <TouchableOpacity style={styles.optionRow} onPress={onPress}>
            {icon}
            <Text style={styles.optionText}>{text}</Text>
            <Text style={styles.optionChevron}>›</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerBar}>
                <Text style={styles.headerTitle}>Profile</Text>
            </View>

            <View style={styles.profileCard}>
                <Image source={require('../../assets/MainProfile.png')} style={styles.profileAvatar} />
                <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{currentUser.username}</Text>
                    <Text style={styles.profileEmail}>{currentUser.email}</Text>
                </View>
            </View>

            <View style={styles.optionsContainer}>
                <ProfileOption
                    icon={<SettingsIcon />}
                    text="Settings"
                    onPress={() => console.log('Settings Pressed (Manual)')}
                />
                <ProfileOption
                    icon={<HelpIcon />}
                    text="Help center"
                    onPress={() => console.log('Help center Pressed (Manual)')}
                />
                <ProfileOption
                    icon={<LogoutIcon />}
                    text="Log out"
                    onPress={handleLogout}
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    headerBar: {
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 15,
        backgroundColor: '#fff'
    },
    headerTitle: { fontSize: 32, fontWeight: 'bold' },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0'
    },
    profileAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 15,
    },
    profileInfo: { flex: 1 },
    profileName: { fontSize: 18, fontWeight: 'bold' },
    profileEmail: { fontSize: 14, color: '#8A8A8E', marginTop: 4 },
    threeDots: { fontSize: 24, fontWeight: 'bold', color: '#8A8A8E' },
    optionsContainer: { marginTop: 20, paddingHorizontal: 20 },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0'
    },
    optionText: { fontSize: 17, flex: 1, marginLeft: 15 },
    optionChevron: { fontSize: 20, color: '#C7C7CC' },
});

export default ProfileScreen;