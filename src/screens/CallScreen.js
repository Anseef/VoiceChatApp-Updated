// CallScreen.js

import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAppContext } from '../context/AppContext';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { FontAwesome } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { imageMap } from '../utils/imageMap';

const CallScreen = ({ route, navigation }) => {
  const { isAccessibilityMode } = useAppContext();
  const { recognizedText, setRecognizedText, startListening, stopListening } = useVoiceRecognition();
  const contact = route.params?.contact;

  const [callStatus, setCallStatus] = useState('Ringing...');
  const [sound, setSound] = useState();
  const hasSpokenGreeting = useRef(false);

  // --- Effect to play ringing sound ---
  useEffect(() => {
    const playRingingSound = async () => {
      console.log('Loading Sound');
      const { sound } = await Audio.Sound.createAsync(
        //  require('../../assets/sounds/ringing.mp3'), // IMPORTANT: Update this path
         { isLooping: true }
      );
      setSound(sound);
      Speech.stop();

      console.log('Playing Sound');
      await sound.playAsync();
    };

    playRingingSound();

    // Cleanup function to stop and unload sound when the screen is left
    return () => {
      console.log('Unloading Sound');
      Speech.stop();
      sound?.unloadAsync();
      Speech.stop();
    };
  }, []);

  // --- Effect for initial greeting and call status change ---
  useEffect(() => {
    if (!contact || hasSpokenGreeting.current) return;

    Speech.speak(`Calling ${contact.name}. Say 'exit call' to hang up.`);
    hasSpokenGreeting.current = true;

    // Simulate the call being answered
    const timer = setTimeout(() => {
      setCallStatus('00:01');
    }, 4000); // Ring for 4 seconds
    Speech.stop();
    return () => clearTimeout(timer);
  }, [contact]);

  // --- Effect to update call timer ---
  useEffect(() => {
    if (callStatus.includes(':')) { // Start timer only when connected
      const interval = setInterval(() => {
        setCallStatus(prevStatus => {
          const parts = prevStatus.split(':').map(Number);
          let [minutes, seconds] = parts;
          seconds++;
          if (seconds === 60) {
            seconds = 0;
            minutes++;
          }
          return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [callStatus]);

  // --- Effect for "Exit Call" voice command ---
  useEffect(() => {
    if (!isAccessibilityMode || !recognizedText) return;

    const lower = recognizedText.toLowerCase().trim();
    setRecognizedText('');

    if (lower.includes('exit call') || lower.includes('end call')) {
      Speech.speak('Ending call.', {
        onDone: () => navigation.goBack(),
      });
    }
  }, [recognizedText, isAccessibilityMode]);


  if (!contact) {
    return <SafeAreaView style={styles.container}><Text>Contact not found.</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Image
        source={imageMap[contact.image] || { uri: contact.image }}
        style={styles.profileImage}
      />
      <Text style={styles.contactName}>{contact.name}</Text>
      <Text style={styles.callStatus}>{callStatus}</Text>

      <TouchableOpacity style={styles.endCallButton} onPress={() => navigation.navigate('Home')}>
        <FontAwesome name="phone" size={32} color="#fff" style={styles.endCallIcon} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e', // Dark background for call screen
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#555',
  },
  contactName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  callStatus: {
    fontSize: 18,
    color: '#a0a0a0',
    marginBottom: 100,
  },
  endCallButton: {
    position: 'absolute',
    bottom: 60,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#E53E3E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallIcon: {
    transform: [{ rotate: '135deg' }],
  },
});

export default CallScreen;