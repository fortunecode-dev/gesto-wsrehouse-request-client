import { useAppTheme } from '@/providers/ThemeProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

const COUNT_TIMES_KEY = 'COUNT_TIMES';

export default function Ajustes() {
  const { theme, toggleTheme } = useAppTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [serverUrl, setServerUrl] = useState('');

  // Campo editable como string para permitir borrar (''), se normaliza en onBlur
  const [countTimesInput, setCountTimesInput] = useState<string>('1');

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

  const handleCountTimesChange = (text: string) => {
    // Solo dígitos; permitir vacío mientras escribe
    const cleaned = text.replace(/[^\d]/g, '');
    setCountTimesInput(cleaned);
  };

  const commitCountTimes = async () => {
    // Si está vacío o < 1 -> guardar 1
    let n = parseInt(countTimesInput || '', 10);
    if (isNaN(n) || n < 1) n = 1;
    setCountTimesInput(String(n));
    await AsyncStorage.setItem(COUNT_TIMES_KEY, String(n));
  };

  const loadSettings = async () => {
    const url = await AsyncStorage.getItem('SERVER_URL');
    if (url !== null) setServerUrl(url);

    // Cargar/normalizar COUNT_TIMES (default 1)
    const ct = await AsyncStorage.getItem(COUNT_TIMES_KEY);
    if (ct === null) {
      setCountTimesInput('1');
      await AsyncStorage.setItem(COUNT_TIMES_KEY, '1');
    } else {
      const n = Math.max(1, parseInt(ct, 10) || 1);
      setCountTimesInput(String(n));
      if (String(n) !== ct) {
        await AsyncStorage.setItem(COUNT_TIMES_KEY, String(n));
      }
    }

    // const notif = await AsyncStorage.getItem('NOTIFICATIONS_ENABLED');
    // if (notif !== null) setNotificationsEnabled(JSON.parse(notif));
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

        {/* Notificaciones (opcional) */}
        {false && (
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
        )}

        {/* URL Servidor */}
        <View style={styles.settingRowColumn}>
          <Text style={[styles.label, isDark ? styles.textDark : styles.textLight]}>
            Dirección del servidor
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

        {/* Cantidad de conteos */}
        <View style={styles.settingRowColumn}>
          <Text style={[styles.label, isDark ? styles.textDark : styles.textLight]}>
            Cantidad de conteos
          </Text>
          <TextInput
            value={countTimesInput}
            onChangeText={handleCountTimesChange}
            onBlur={commitCountTimes}           // ← si está vacío, guarda 1
            keyboardType="numeric"
            placeholder="1"
            placeholderTextColor="#9CA3AF"
            style={[
              styles.input,
              isDark ? styles.inputDark : styles.inputLight,
            ]}
          />
          <Text style={[styles.hint, isDark ? styles.textDark : styles.textLight]}>
            Debe ser un número entero ≥ 1. Si dejas el campo vacío, se guardará 1.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 20 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold' },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingRowColumn: { flexDirection: 'column', gap: 8 },
  label: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15 },
  inputLight: { borderColor: '#D1D5DB', backgroundColor: '#F9FAFB', color: '#111827' },
  inputDark: { borderColor: '#4B5563', backgroundColor: '#1F2937', color: '#F3F4F6' },
  dark: { backgroundColor: '#111827' },
  light: { backgroundColor: '#FFFFFF' },
  textDark: { color: '#F3F4F6' },
  textLight: { color: '#111827' },
  hint: { fontSize: 12, opacity: 0.7 },
});
