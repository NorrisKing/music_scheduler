import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

const PASSWORD = 'Schedulebassline1';

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (value === PASSWORD) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth', '1');
      }
      onLogin();
    } else {
      setError(true);
      setValue('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spotify Scheduler</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={value}
          onChangeText={t => { setValue(t); setError(false); }}
          onSubmitEditing={handleSubmit}
          placeholder="••••••••••••"
          placeholderTextColor="#6b7280"
          autoFocus
        />
        {error && (
          <Text style={styles.error}>Mot de passe incorrect</Text>
        )}
        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Connexion</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1DB954',
    marginBottom: 32,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  label: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  error: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1DB954',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
});
