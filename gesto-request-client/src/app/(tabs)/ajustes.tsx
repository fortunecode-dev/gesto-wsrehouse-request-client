import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '@/providers/ThemeProvider';

export default function Ajustes() {
  const { theme, toggleTheme } = useAppTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [serverUrl, setServerUrl] = useState('');

  const isDark = theme === 'dark';

  const toggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    await AsyncStorage.setItem('NOTIFICATIONS_ENABLED', JSON.stringify(newValue));
  };

  const handleServerUrlChange = async (text: string) => {
    setServerUrl(text);
    await AsyncStorage.setItem('SERVER_URL', text);
  };

  const loadSettings = async () => {
    const notif = await AsyncStorage.getItem('NOTIFICATIONS_ENABLED');
    const url = await AsyncStorage.getItem('SERVER_URL');
    if (notif !== null) setNotificationsEnabled(JSON.parse(notif));
    if (url !== null) setServerUrl(url);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDark ? styles.dark : styles.light]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
          Ajustes Generales
        </Text>

        {/* Cambiar tema */}
        <View style={styles.settingRow}>
          <Text style={[styles.label, isDark ? styles.textDark : styles.textLight]}>
            Tema Oscuro
          </Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#ccc', true: '#4ADE80' }}
            thumbColor={isDark ? '#10B981' : '#f4f3f4'}
          />
        </View>

        {/* Notificaciones */}
        <View style={styles.settingRow}>
          <Text style={[styles.label, isDark ? styles.textDark : styles.textLight]}>
            Notificaciones
          </Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: '#ccc', true: '#4ADE80' }}
            thumbColor={notificationsEnabled ? '#10B981' : '#f4f3f4'}
          />
        </View>

        {/* URL Servidor */}
        <View style={styles.settingRowColumn}>
          <Text style={[styles.label, isDark ? styles.textDark : styles.textLight]}>
            URL del servidor
          </Text>
          <TextInput
            value={serverUrl}
            onChangeText={handleServerUrlChange}
            placeholder="https://miapi.com"
            placeholderTextColor="#9CA3AF"
            style={[
              styles.input,
              isDark ? styles.inputDark : styles.inputLight,
            ]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    gap: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingRowColumn: {
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  inputLight: {
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    color: '#111827',
  },
  inputDark: {
    borderColor: '#4B5563',
    backgroundColor: '#1F2937',
    color: '#F3F4F6',
  },
  dark: {
    backgroundColor: '#111827',
  },
  light: {
    backgroundColor: '#FFFFFF',
  },
  textDark: {
    color: '#F3F4F6',
  },
  textLight: {
    color: '#111827',
  },
});
