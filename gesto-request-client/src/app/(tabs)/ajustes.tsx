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
const WIFI_TARGET_NAME_KEY = 'WIFI_TARGET_NAME';
const POS_MODE_KEY = 'POS_MODE';
const EXCHANGE_KEYS = ["USD","EUR","CAN"];

export default function Ajustes() {
  const { theme, toggleTheme } = useAppTheme();

  const [serverUrl, setServerUrl] = useState('');
  const [countTimesInput, setCountTimesInput] = useState<string>('1');
  const [wifiNameInput, setWifiNameInput] = useState<string>('');
  const [posModeEnabled, setPosModeEnabled] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<Record<string,string | null>>({
    USD: null,
    EUR: null,
    CAN: null,
  });

  const isDark = theme === 'dark';

  const togglePosMode = async () => {
    const newValue = !posModeEnabled;
    setPosModeEnabled(newValue);
    await AsyncStorage.setItem(POS_MODE_KEY, JSON.stringify(newValue));
  };

  const handleServerUrlChange = async (text: string) => {
    setServerUrl(text);
    await AsyncStorage.setItem('SERVER_URL', text);
  };

  const handleCountTimesChange = (text: string) => {
    const cleaned = text.replace(/[^\d]/g, '');
    setCountTimesInput(cleaned);
  };

  const commitCountTimes = async () => {
    let n = parseInt(countTimesInput || '', 10);
    if (isNaN(n) || n < 1) n = 1;
    setCountTimesInput(String(n));
    await AsyncStorage.setItem(COUNT_TIMES_KEY, String(n));
  };

  const commitWifiName = async () => {
    const trimmed = wifiNameInput.trim();
    setWifiNameInput(trimmed);
    await AsyncStorage.setItem(WIFI_TARGET_NAME_KEY, trimmed);
  };

  const loadExchangeRates = async () => {
    const rates: Record<string,string | null> = { USD: null, EUR: null, CAN: null };
    for (const key of EXCHANGE_KEYS) {
      const value = await AsyncStorage.getItem(`EXCHANGE_${key}`);
      rates[key] = value ?? null;
    }
    setExchangeRates(rates);
  };

  const handleExchangeChange = (currency: string, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    setExchangeRates(prev => ({ ...prev, [currency]: cleaned }));
  };

  const commitExchange = async (currency: string) => {
    await AsyncStorage.setItem(`EXCHANGE_${currency}`, exchangeRates[currency] ?? '');
    await AsyncStorage.removeItem("DESGLOSE_DATA")
  };

  const loadSettings = async () => {
    const url = await AsyncStorage.getItem('SERVER_URL');
    if (url !== null) setServerUrl(url);

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

    const wn = await AsyncStorage.getItem(WIFI_TARGET_NAME_KEY);
    setWifiNameInput(wn ?? '');

    const pos = await AsyncStorage.getItem(POS_MODE_KEY);
    if (pos !== null) setPosModeEnabled(JSON.parse(pos));

    await loadExchangeRates();
  };

  useEffect(() => { loadSettings(); }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDark ? styles.dark : styles.light]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
          Ajustes Generales
        </Text>

        {/* Tema Oscuro */}
        <View style={styles.settingRow}>
          <Text style={[styles.label, isDark ? styles.textDark : styles.textLight]}>Tema Oscuro</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#ccc', true: '#4ADE80' }}
            thumbColor={isDark ? '#10B981' : '#f4f3f4'}
          />
        </View>

        {/* Modo punto de venta */}
        <View style={styles.settingRow}>
          <Text style={[styles.label, isDark ? styles.textDark : styles.textLight]}>
            Modo punto de venta
          </Text>
          <Switch
            value={posModeEnabled}
            onValueChange={togglePosMode}
            trackColor={{ false: '#ccc', true: '#4ADE80' }}
            thumbColor={posModeEnabled ? '#10B981' : '#f4f3f4'}
          />
        </View>

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
            style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
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
            onBlur={commitCountTimes}
            keyboardType="numeric"
            placeholder="1"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
          />
        </View>

        {/* Nombre Wi-Fi */}
        <View style={styles.settingRowColumn}>
          <Text style={[styles.label, isDark ? styles.textDark : styles.textLight]}>
            Nombre de la Wi-Fi objetivo
          </Text>
          <TextInput
            value={wifiNameInput}
            onChangeText={setWifiNameInput}
            onBlur={commitWifiName}
            placeholder='Ej: "MiRedLocal"'
            placeholderTextColor="#9CA3AF"
            style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Tasas de cambio */}
        <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
          Tasas de cambio
        </Text>
        {EXCHANGE_KEYS.map(currency => (
          <View key={currency} style={styles.settingRowColumn}>
            <Text style={[styles.label, isDark ? styles.textDark : styles.textLight]}>
              {currency}
            </Text>
            <TextInput
              value={exchangeRates[currency] ?? ''}
              onChangeText={text => handleExchangeChange(currency, text)}
              onBlur={() => commitExchange(currency)}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            />
          </View>
        ))}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 20 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingRowColumn: { flexDirection: 'column', gap: 8 },
  label: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15 },
  inputLight: { borderColor: '#D1D5DB', backgroundColor: '#F9FAFB', color: '#111827' },
  inputDark: { borderColor: '#4B5563', backgroundColor: '#1F2937', color: '#F3F4F6' },
  dark: { backgroundColor: '#111827' },
  light: { backgroundColor: '#FFFFFF' },
  textDark: { color: '#F3F4F6' },
  textLight: { color: '#111827' },
});
