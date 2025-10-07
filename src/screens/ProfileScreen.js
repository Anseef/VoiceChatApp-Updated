import React, { useEffect } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useAppContext } from '../context/AppContext';
import { FontAwesome } from "@expo/vector-icons";
import { useVoiceRecognition } from '../hooks/useVoiceRecognition'; // Import your voice recognition hook
import * as Speech from 'expo-speech'; // Import Speech for responses

// --- Icon Components (unchanged from your last request) ---
const SettingsIcon = ({ color = '#000', size = 24 }) => (
    <FontAwesome name="cog" size={size} color={color} />
);
const HelpIcon = ({ color = '#000', size = 24 }) => (
    <FontAwesome name="question-circle" size={size} color={color} />
);
const LogoutIcon = ({ color = '#000', size = 24 }) => (
    <FontAwesome name="sign-out" size={size} color={color} />
);
// -----------------------------------------------------------

// --- ProfileScreen Component ---
const ProfileScreen = ({ navigation }) => { // Ensure navigation prop is received
    const { isAccessibilityMode, setIsAuthenticated } = useAppContext();
    const handleLogout = () => setIsAuthenticated(false);

    // Initialize voice recognition
    const { status, recognizedText, error, startListening, setRecognizedText } = useVoiceRecognition();

    // Effect for when the screen gains focus in accessibility mode
    useEffect(() => {
        const onFocus = () => {
            if (isAccessibilityMode) {
                Speech.speak(
                    "You are on the profile screen. Say 'go to chats', 'go to settings', 'go to help center', or 'log out'.",
                    { onDone: startListening }
                );
            }
        };
        const unsubscribe = navigation.addListener('focus', onFocus);
        return unsubscribe;
    }, [navigation, isAccessibilityMode, startListening]); // Added startListening to dependencies

    // Effect to process recognized voice commands
    useEffect(() => {
        if (!isAccessibilityMode || status !== 'idle' || !recognizedText) return;

        const lowerCaseText = recognizedText.toLowerCase();

        if (lowerCaseText.includes('go to chats') || lowerCaseText.includes('go to homepage')) {
            Speech.speak("Navigating to chats.", { onDone: () => navigation.navigate('Chats') }); // Assuming 'HomeTabs' is your main contacts/chats screen
        } else if (lowerCaseText.includes('go to settings')) {
            Speech.speak("Navigating to settings.", { onDone: () => console.log('Navigate to Settings') }); // Implement actual navigation if you have a Settings screen
        } else if (lowerCaseText.includes('go to help center')) {
            Speech.speak("Navigating to help center.", { onDone: () => console.log('Navigate to Help Center') }); // Implement actual navigation
        } else if (lowerCaseText.includes('log out')) {
            Speech.speak("Logging you out. Goodbye!", { onDone: handleLogout });
        } else {
            Speech.speak("Sorry, I didn't understand that command on the profile screen. Please try again.", { onDone: startListening });
        }

        setRecognizedText(''); // Clear recognized text after processing
    }, [recognizedText, status, isAccessibilityMode, navigation, startListening, handleLogout]); // Added dependencies

    const ProfileOption = ({ icon, text, onPress }) => (
        <TouchableOpacity style={styles.optionRow} onPress={onPress}>
            {icon}
            <Text style={styles.optionText}>{text}</Text>
            <Text style={styles.optionChevron}>›</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.headerBar}>
                <Text style={styles.headerTitle}>Profile</Text>
            </View>

            {/* Profile Card */}
            <View style={styles.profileCard}>
                <Image source={require('../../assets/MainProfile.png')} style={styles.profileAvatar} />
                <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>Yato</Text>
                    <Text style={styles.profileEmail}>official4yato@gmail.com</Text>
                </View>
                <TouchableOpacity>
                    <Text style={styles.threeDots}>...</Text>
                </TouchableOpacity>
            </View>

            {/* Options */}
            <View style={styles.optionsContainer}>
                <ProfileOption
                    icon={<SettingsIcon />}
                    text="Settings"
                    onPress={() => console.log('Settings Pressed (Manual)')} // Manual press action
                />
                <ProfileOption
                    icon={<HelpIcon />}
                    text="Help center"
                    onPress={() => console.log('Help center Pressed (Manual)')} // Manual press action
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

// --- Styles (unchanged from your last request, except for removing iconPlaceholder) ---
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