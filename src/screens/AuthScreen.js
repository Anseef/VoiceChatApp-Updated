import React, { useState } from 'react';
import {
  SafeAreaView, Text, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Alert, View
} from 'react-native';
import { useAppContext } from '../context/AppContext';

const AuthScreen = () => {
  const { setIsAuthenticated } = useAppContext();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = () => {
    if (email && password) {
      setIsAuthenticated(true);
    } else {
      Alert.alert('Validation Error', 'Please enter email and password.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior="padding" style={styles.keyboardView}>
        <Text style={styles.title}>{isLogin ? 'Welcome Back!' : 'Create Account'}</Text>
        <Text style={styles.subtitle}>{isLogin ? 'Log in to your account' : 'Sign up to get started'}</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleAuth}>
          <Text style={styles.buttonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
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
