import React, { useState } from 'react';
import {
    SafeAreaView, Text, StyleSheet, TouchableOpacity,
    TextInput, KeyboardAvoidingView, Alert, View, ActivityIndicator
} from 'react-native';
import { useAppContext } from '../context/AppContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.180.131.188:3001';

const AuthScreen = () => {
    const { setIsAuthenticated, setCurrentUser } = useAppContext();
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAuth = async () => {
        let authData = {};
        let endpoint = '';
        let validationError = '';
        
        if (isLogin) {
            // Login requires username (email) and password
            if (!username || !password) {
                validationError = 'Please enter both username and password.';
            } else {
                authData = { username, password };
                endpoint = '/login';
            }
        } else {
            // Signup requires username, email, and password
            if (!username || !email || !password) {
                validationError = 'Please enter username, email, and password.';
            } else {
                authData = { username, email, password }; // Backend expects 'email' and 'password'
                endpoint = '/signup';
            }
        }

        if (validationError) {
            Alert.alert('Validation Error', validationError);
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(authData),
            });

            const data = await response.json();

            if (response.ok) {
                Alert.alert('Success', data.message);
                setIsAuthenticated(true);
                setCurrentUser(data.user);
            } else {
                Alert.alert('Authentication Failed', data.message || 'Something went wrong.');
            }
        } catch (error) {
            console.error("Auth API call error:", error);
            Alert.alert('Network Error', 'Could not connect to the server. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior="padding" style={styles.keyboardView}>
                <Text style={styles.title}>{isLogin ? 'Welcome Back!' : 'Create Account'}</Text>
                <Text style={styles.subtitle}>{isLogin ? 'Log in to your account' : 'Sign up to get started'}</Text>

                <TextInput
                    style={styles.input}
                    placeholder="Username"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    editable={!isLoading}
                />

                {!isLogin && ( // Only show email field for signup
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
                    style={styles.button}
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
                    setUsername(''); // Clear fields on switch
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
        marginBottom: 15, borderWidth: 1, borderColor: '#f0f0f0'
    },
    button: {
        width: '100%', height: 50, backgroundColor: '#111',
        borderRadius: 10, justifyContent: 'center', alignItems: 'center',
        marginTop: 10, elevation: 3
    },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    switchText: { color: '#6074e0ff', marginTop: 20, fontSize: 16, fontWeight: '600' },
});

export default AuthScreen;