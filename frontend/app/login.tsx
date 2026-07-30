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
      <Text style={styles.title}>Sonora</Text>
      <Text style={styles.tagline}>L'ambiance, à l'heure près</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={value}
          onChangeText={t => { setValue(t); setError(false); }}
          onSubmitEditing={handleSubmit}
          placeholder="••••••••••••"
          placeholderTextColor="#6b5f45"
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
    backgroundColor: '#0b0b0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontFamily: 'PlayfairDisplay',
    fontSize: 32,
    fontWeight: '600',
    color: '#c9a227',
    letterSpacing: 0.5,
  },
  tagline: {
    color: '#8a7c5f',
    fontSize: 13,
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#141210',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#3a3226',
  },
  label: {
    color: '#a89a7d',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: '#0f0d0b',
    borderWidth: 1,
    borderColor: '#3a3226',
    borderRadius: 10,
    padding: 14,
    color: '#f2ead9',
    fontSize: 16,
    marginBottom: 12,
  },
  error: {
    color: '#e0745a',
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#c9a227',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#0b0b0a',
    fontWeight: '700',
    fontSize: 15,
  },
});
