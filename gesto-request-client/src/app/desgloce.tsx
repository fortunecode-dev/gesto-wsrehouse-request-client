import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppTheme } from "@/providers/ThemeProvider";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

const DENOMINACIONES = [
  1000, 500, 200, 100, 50, 20, 10, 5, 1,
  "USD", "EUR", "CAN", "Transferencia"
];

const EXCHANGE_KEYS = ["USD", "EUR", "CAN"];

export default function Caja() {
  const { importe, comision } = useLocalSearchParams<{ importe?: string; comision?: string }>();
  const importeNumber = parseFloat(importe || "0") || 0;
  const comisionNumber = parseFloat(comision || "0") || 0;

  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const { theme } = useAppTheme();
  const isDark = theme === "dark";
  const themeColors = {
    background: isDark ? "#111827" : "#f2f2f2",
    card: isDark ? "#1f2937" : "#fff",
    text: isDark ? "#f9fafb" : "#2c3e50",
    border: isDark ? "#374151" : "#e0e0e0",
    inputBg: isDark ? "#1f2937" : "#fafafa",
    inputText: isDark ? "#f3f4f6" : "#2c3e50",
    primary: isDark ? "#60A5FA" : "#3498db",
  };

  // ---------- carga inicial ----------
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        setLoading(true);
        try {
          const rawCantidades = await AsyncStorage.getItem("CAJA_DATA");
          if (rawCantidades) {
            try {
              const parsed = JSON.parse(rawCantidades);
              setCantidades(parsed);
            } catch {
              setCantidades({});
            }
          } else {
            setCantidades({});
          }

          const rates: Record<string, number> = {};
          for (const key of EXCHANGE_KEYS) {
            const value = await AsyncStorage.getItem(`EXCHANGE_${key}`);
            rates[key] = value ? parseFloat(value) : 0;
          }
          setExchangeRates(rates);

          // si hay CAJA_DATA o tasas, recalcular y guardar DESGLOSE_DATA
          // (esto asegura que exista DESGLOSE_DATA tras la carga)
          const initialCant = rawCantidades ? JSON.parse(rawCantidades) : {};
          await saveDesgloseTotals(initialCant, rates);
        } catch (e) {
          console.warn("Error loading caja data:", e);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, [])
  );

  // ---------- persistir cantidades en CAJA_DATA y recalcular desglose ----------
  const saveCantidades = async (key: string, value: string) => {
    try {
      const updated = { ...cantidades, [key]: value };
      setCantidades(updated);
      await AsyncStorage.setItem("CAJA_DATA", JSON.stringify(updated));
      // recalcular y guardar desglose
      await saveDesgloseTotals(updated, exchangeRates);
    } catch (e) {
      console.warn("Error saving CAJA_DATA:", e);
    }
  };

  // función que calcula valor por clave (numerica/moneda/transferencia)
  const calcularValor = (key: string, currentCantidades: Record<string, string>, rates: Record<string, number>): number => {
    const cantidad = parseInt(currentCantidades[key] || "0", 10) || 0;
    if (!isNaN(Number(key)) && Number.isFinite(Number(key))) {
      return cantidad * Number(key);
    } else if (EXCHANGE_KEYS.includes(key)) {
      return cantidad * (rates[key] || 0);
    } else {
      // Transferencia u otros: asumimos cantidad es ya el valor en moneda local
      return cantidad;
    }
  };

  // calcula suma total con los datos actuales (sin mutar estado)
  const calcularSumaDenominaciones = (currentCantidades: Record<string, string>, rates: Record<string, number>) => {
    return Number(DENOMINACIONES.reduce((acc, key) => {
      return Number(acc) + calcularValor(String(key), currentCantidades, rates);
    }, 0));
  };

  // ---------- guardar DESGLOSE_DATA con totals y meta ----------
  const saveDesgloseTotals = async (currentCantidades: Record<string, string>, rates: Record<string, number>) => {
    try {
      const totalCaja = calcularSumaDenominaciones(currentCantidades, rates);
      const propina = totalCaja - importeNumber;
      // Salario es (según tu UI anterior) propina + comision
      const salario = propina + comisionNumber;
      // Liquidación: tal como tenías antes => total - propina(if>0) - comision
      const liquidacion = totalCaja - (propina > 0 ? propina : 0) - comisionNumber;

      const payload = {
        meta: { savedAt: new Date().toISOString() },
        denominations: currentCantidades,
        exchangeRates: rates,
        totals: {
          totalCaja: Number(totalCaja.toFixed(2)),
          propina: Number(propina.toFixed(2)),
          comision: Number(comisionNumber.toFixed(2)),
          salario: Number(salario.toFixed(2)),
          liquidacion: Number(liquidacion.toFixed(2)),
          importe: Number(importeNumber.toFixed(2)),
        },
      };

      await AsyncStorage.setItem("DESGLOSE_DATA", JSON.stringify(payload));
    } catch (e) {
      console.warn("Error saving DESGLOSE_DATA:", e);
    }
  };

  // recalcular el desglose cuando cambien rates (y persistir)
  useEffect(() => {
    // cada vez que cambien las tasas, recalculamos y guardamos
    (async () => {
      try {
        await saveDesgloseTotals(cantidades, exchangeRates);
      } catch (e) {
        // noop
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchangeRates]);

  // ---------- valores de UI calculados desde el estado actual ----------
  const sumaDenominaciones = calcularSumaDenominaciones(cantidades, exchangeRates);
  const propina = sumaDenominaciones - importeNumber;
  const liquidacion = sumaDenominaciones - (propina > 0 ? propina : 0) - comisionNumber;

  if (loading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
  }

  function handleBack(): void {
    router.push({ pathname: "/(tabs)/final" });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: themeColors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        <Text style={[styles.importe, { color: themeColors.text }]}>
          Importe: ${importeNumber.toFixed(2)}
        </Text>

        <FlatList
          data={DENOMINACIONES}
          keyExtractor={(item) => item.toString()}
          renderItem={({ item }) => (
            <View style={[styles.row, { borderColor: themeColors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Text style={[styles.label, { color: themeColors.text }]}>
                  {item} {EXCHANGE_KEYS.includes(item.toString()) ? `( $${exchangeRates[item] || 0} )` : ""}
                </Text>
              </View>
              <TextInput
                keyboardType="number-pad"
                value={cantidades[item] || ""}
                onChangeText={(text) => saveCantidades(item.toString(), text)}
                style={[
                  styles.input,
                  { backgroundColor: themeColors.inputBg, color: themeColors.inputText, borderColor: themeColors.border },
                ]}
                placeholder="0"
                placeholderTextColor="#888"
              />
            </View>
          )}
          scrollEnabled={false}
        />

        <Text
          style={[
            styles.importe,
            { color: sumaDenominaciones >= importeNumber ? "#2ecc71" : "#e74c3c", },
          ]}
        >
          Total en caja: ${sumaDenominaciones.toFixed(2)}
        </Text>

        {
          sumaDenominaciones >= importeNumber && <> <Text style={[styles.importe, { color: themeColors.text }]}>
            Propina automática: ${propina.toFixed(2)}
          </Text>
            <Text style={[styles.importe, { color: themeColors.text }]}>Comisión: ${comisionNumber.toFixed(2)}</Text>
            <Text style={[styles.importe, { color: themeColors.text }]}>Salario: ${(propina + comisionNumber).toFixed(2)}</Text>

            <Text style={[styles.importe, { color: themeColors.text }]}>
              Liquidación: ${liquidacion.toFixed(2)}
            </Text>
          </>
        }

        <TouchableOpacity
          onPress={handleBack}
          style={[styles.button, { backgroundColor: themeColors.primary }]}
        >
          <Text style={styles.buttonText}>Atrás</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: 6,
    alignItems: "center",
  },
  label: { fontSize: 14 },
  input: { width: 80, borderWidth: 1, borderRadius: 4, padding: 4, textAlign: "right", fontSize: 14 },
  button: { paddingVertical: 10, borderRadius: 6, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#fff", fontWeight: "600" },
  importe: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
});
