// src/hooks/useVoiceRecognition.js

import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// Define recording settings for cross-platform compatibility with the Gemini API
const recordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
};

export const useVoiceRecognition = () => {
  const [status, setStatus] = useState('idle');
  const [recognizedText, setRecognizedText] = useState('');
  const [error, setError] = useState('');
  const recognition = useRef(null);
  const isOperationInProgress = useRef(false);

  useEffect(() => {
    Audio.requestPermissionsAsync();
    return () => {
      if (recognition.current) {
        recognition.current.stopAndUnloadAsync();
      }
    };
  }, []);

  const startListening = async () => {
    if (isOperationInProgress.current) return;
    try {
      isOperationInProgress.current = true;
      setStatus('listening');
      setRecognizedText('');
      setError('');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      
      // --- FIX START ---
      // Pass the entire recordingOptions object. Expo AV will automatically
      // use the correct settings for the current platform (iOS or Android).
      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      // --- FIX END ---
      
      recognition.current = recording;
      setTimeout(() => stopAndTranscribe(), 4000);
    } catch (e) {
      console.error('Failed to start recording', e);
      setError('Failed to start recording.');
      setStatus('idle');
      isOperationInProgress.current = false;
    }
  };

  const stopAndTranscribe = async () => {
    if (!recognition.current) {
      isOperationInProgress.current = false;
      return;
    }
    setStatus('processing');
    try {
      await recognition.current.stopAndUnloadAsync();
      const uri = recognition.current.getURI();
      recognition.current = null;
      if (!uri) throw new Error("Audio URI not found.");
      
      const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API key is missing.");
      
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      
      const payload = {
        contents: [{ 
          parts: [
            {text: "Transcribe this voice command accurately. The speaker has an Indian English accent and is navigating a mobile app." },
            { inlineData: { mimeType: 'audio/mp4', data: base64Audio } }
          ] 
        }],
      };

      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      
      if (!response.ok) {
        const errorBody = await response.json();
        console.error('API Error Response:', JSON.stringify(errorBody, null, 2));
        throw new Error(`API call failed: ${response.status}`);
      }
      
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      setRecognizedText(text?.trim() || '');
    } catch (e) {
      console.error('Error during transcription:', e.message);
      setError('Sorry, I could not understand.');
    } finally {
      setStatus('idle');
      isOperationInProgress.current = false;
    }
  };

  return { status, recognizedText, error, startListening, setRecognizedText };
};