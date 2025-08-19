// src/components/WifiBanner.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, PermissionsAndroid, Platform, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const WIFI_TARGET_NAME_KEY = 'WIFI_TARGET_NAME';
const DEFAULT_WIFI = 'wifipost';

async function requestAndroidWifiPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const sdk = Number(Platform.Version);
    const perms: string[] = [];

    if (sdk >= 33) {
      // Android 13+: NEARBY_WIFI_DEVICES (algunos equipos igual requieren FINE_LOCATION)
      perms.push('android.permission.NEARBY_WIFI_DEVICES');
    } else {
      // Android 12-: FINE_LOCATION para leer SSID
      perms.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    }

    const results = await PermissionsAndroid.requestMultiple(perms as any);
    return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
  } catch {
    return false;
  }
}

export function useTargetWifiName() {
  const [name, setName] = useState<string>(DEFAULT_WIFI);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(WIFI_TARGET_NAME_KEY);
        const finalName = (stored && stored.trim().length > 0) ? stored.trim() : DEFAULT_WIFI;
        setName(finalName);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { name, loading };
}

export default function WifiBanner() {
  const { name: targetName, loading } = useTargetWifiName();
  const [showBanner, setShowBanner] = useState(false);
  const [currentSsid, setCurrentSsid] = useState<string | null>(null);
  const [permissionsOk, setPermissionsOk] = useState<boolean>(Platform.OS !== 'android' ? true : false);

  // Para no repetir alertas
  const permAlertShown = useRef(false);
  const locationAlertShown = useRef(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let mounted = true;

    (async () => {
      // 1) Pedir permisos al montar
      const ok = await requestAndroidWifiPermissions();
      if (mounted) setPermissionsOk(ok);

      if (Platform.OS === 'android' && !ok && !permAlertShown.current) {
        permAlertShown.current = true;
        Alert.alert(
          'Permisos requeridos',
          'Para detectar el nombre de la Wi‑Fi necesitamos permisos. Sin ellos, no se puede comprobar el SSID.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Abrir Ajustes',
              onPress: () => Linking.openSettings().catch(() => {}),
            },
          ],
        );
      }

      // 2) Suscribirse a cambios de red
      unsubscribe = NetInfo.addEventListener((state) => {
        if (!mounted) return;

        const ssid =
          state.details && 'ssid' in (state.details as any)
            ? ((state.details as any).ssid ?? null)
            : null;

        setCurrentSsid(ssid);

        // Mostrar banner si:
        // - No hay Wi‑Fi
        // - O no hay SSID legible (permisos/ubicación) → asumimos que no está en la red objetivo
        // - O el SSID es distinto al objetivo
        if (state.type === 'wifi' && ssid) {
          setShowBanner(ssid !== targetName);
        } else {
          setShowBanner(true);

          // Caso específico Android: estás en Wi‑Fi pero SSID llega null => ubicación apagada o política del dispositivo
          if (
            Platform.OS === 'android' &&
            permissionsOk &&                // ya concedidos
            state.type === 'wifi' &&
            !ssid &&
            !locationAlertShown.current
          ) {
            locationAlertShown.current = true;
            Alert.alert(
              'Activa la ubicación',
              'No se puede leer el nombre de la Wi‑Fi porque la ubicación del dispositivo está desactivada. Actívala para poder comprobar el SSID.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Abrir Ajustes',
                  onPress: () => Linking.openSettings().catch(() => {}),
                },
              ],
            );
          }
        }
      });
    })();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [targetName]);

  if (loading || !showBanner) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        ⚠️ No estás conectado a la red <Text style={styles.bold}>{targetName}</Text>
        {currentSsid ? ` (SSID actual: ${currentSsid})` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FDE047',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#FACC15',
  },
  text: { color: '#111827', textAlign: 'center' },
  bold: { fontWeight: '700' },
});
