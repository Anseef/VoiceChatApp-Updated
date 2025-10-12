import React, { useState } from 'react';
import {
    SafeAreaView, Text, StyleSheet, TouchableOpacity,
    TextInput, KeyboardAvoidingView, Alert, View, ActivityIndicator,
    Modal // <-- Import Modal
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons'; // For the success icon
import { useAppContext } from '../context/AppContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.180.131.188:3001';

const AuthScreen = () => {
    const { setIsAuthenticated, setCurrentUser } = useAppContext();
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // --- State for custom modals ---
    const [isSuccessModalVisible, setSuccessModalVisible] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [authSuccessData, setAuthSuccessData] = useState(null);
    const [isErrorModalVisible, setErrorModalVisible] = useState(false); // State for error modal
    const [errorMessage, setErrorMessage] = useState('');           // State for error message

    const handleAuth = async () => {
        let authData = {};
        let endpoint = '';
        let validationError = '';
        
        if (isLogin) {
            if (!username || !password) {
                validationError = 'Username and password are required.';
            } else {
                authData = { username, password };
                endpoint = '/login';
            }
        } else {
            if (!username || !email || !password) {
                validationError = 'All fields are mandatory.';
            } else {
                authData = { username, email, password };
                endpoint = '/signup';
            }
        }

        if (validationError) {
            // Show custom error modal for validation
            setErrorMessage(validationError);
            setErrorModalVisible(true);
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(authData),
            });

            const data = await response.json();

            if (response.ok) {
                // Show custom success modal
                setModalMessage(data.message);
                setAuthSuccessData(data.user);
                setSuccessModalVisible(true);
            } else {
                // Show custom error modal for auth failure
                setErrorMessage(data.message || 'Something went wrong.');
                setErrorModalVisible(true);
            }
        } catch (error) {
            console.error("Auth API call error:", error);
            // Show custom error modal for network issues
            setErrorMessage('Could not connect to the server. Please try again.');
            setErrorModalVisible(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuccessModalClose = () => {
        setSuccessModalVisible(false);
        if (authSuccessData) {
            setIsAuthenticated(true);
            setCurrentUser(authSuccessData);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- CUSTOM SUCCESS MODAL --- */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isSuccessModalVisible}
                onRequestClose={handleSuccessModalClose}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalView}>
                        <FontAwesome name="check-circle" size={50} color="#586eeb"/>
                        <Text style={styles.modalTitle}>Success!</Text>
                        <Text style={styles.modalMessage}>{modalMessage}</Text>
                        <TouchableOpacity style={styles.modalButton} onPress={handleSuccessModalClose}>
                            <Text style={styles.modalButtonText}>Continue</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* --- CUSTOM ERROR MODAL --- */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isErrorModalVisible}
                onRequestClose={() => setErrorModalVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalView}>
                        <FontAwesome name="times-circle" size={50} color="#E53E3E"/>
                        <Text style={styles.errorModalTitle}>Oops!</Text>
                        <Text style={styles.modalMessage}>{errorMessage}</Text>
                        <TouchableOpacity style={styles.errorModalButton} onPress={() => setErrorModalVisible(false)}>
                            <Text style={styles.modalButtonText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            
            <KeyboardAvoidingView behavior="padding" style={styles.keyboardView}>
                <Text style={styles.title}>{isLogin ? 'Welcome Back!' : 'Create Account'}</Text>
                <Text style={styles.subtitle}>{isLogin ? 'Log in to your account' : 'Sign up to get started'}</Text>

                <TextInput
                    style={styles.input}
                    placeholder={isLogin ? "Username or Email" : "Username"}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    editable={!isLoading}
                />

                {!isLogin && (
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        editable={!isLoading}
                    />
                )}

                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    editable={!isLoading}
                />

                <TouchableOpacity
                    style={[styles.button, isLoading && styles.buttonDisabled]}
                    onPress={handleAuth}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => {
                    setIsLogin(!isLogin);
                    setUsername('');
                    setEmail('');
                    setPassword('');
                }} disabled={isLoading}>
                    <Text style={styles.switchText}>
                        {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                    </Text>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', padding: 20 },
    keyboardView: { width: '100%', alignItems: 'center' },
    title: { fontSize: 32, fontWeight: 'bold', color: '#000', marginBottom: 10 },
    subtitle: { fontSize: 16, color: '#666', marginBottom: 30 },
    input: {
        width: '100%', height: 50, backgroundColor: '#f0f0f0',
        borderRadius: 10, paddingHorizontal: 15, fontSize: 16,
        marginBottom: 15, borderWidth: 1, borderColor: '#e0e0e0'
    },
    button: {
        width: '100%', height: 50, backgroundColor: '#111',
        borderRadius: 10, justifyContent: 'center', alignItems: 'center',
        marginTop: 10, elevation: 3
    },
    buttonDisabled: {
        backgroundColor: '#555',
    },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    switchText: { color: '#6074e0ff', marginTop: 20, fontSize: 16, fontWeight: '600' },
    
    // --- Styles for Modals ---
    modalBackdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    modalView: {
        width: '80%',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 25,
        alignItems: 'center',
        shadowColor: '#e7e5e5ff',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 10,
        color: '#333',
    },
    errorModalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 10,
        color: '#E53E3E', // Error color for the title
    },
    modalMessage: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 25,
    },
    modalButton: {
        backgroundColor: '#586eeb',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 30,
        elevation: 2,
    },
    errorModalButton: {
        backgroundColor: '#E53E3E',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 30,
        elevation: 2,
    },
    modalButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default AuthScreen;