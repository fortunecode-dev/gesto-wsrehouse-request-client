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
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppTheme } from "@/providers/ThemeProvider";
import { Link, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

type CantidadesMap = Record<string, string>;
type RatesMap = Record<string, number>;

const DENOMINACIONES: (number | string)[] = [
  1000, 500, 200, 100, 50, 20, 10, 5, 3, 1,
  "USD", "EUR", "CAN", "Transferencia",
];
const EXCHANGE_KEYS = ["USD", "EUR", "CAN"];

export default function Caja() {
  const { importe, comision } = useLocalSearchParams<{ importe?: string; comision?: string }>();
  const importeNumber = parseFloat(importe || "0") || 0;
  const comisionNumber = parseFloat(comision || "0") || 0;

  const [cantidades, setCantidades] = useState<CantidadesMap>({});
  const [exchangeRates, setExchangeRates] = useState<RatesMap>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [propinaManual, setPropinaManual] = useState<string>("0");
  const { theme } = useAppTheme();
  const isDark = theme === "dark";

  const themeColors = {
    background: isDark ? "#0b1220" : "#f5f7fb",
    card: isDark ? "#0f1724" : "#ffffff",
    text: isDark ? "#e6eefc" : "#102a43",
    mutted: isDark ? "#9aa6bf" : "#52606d",
    border: isDark ? "#1f2a44" : "#e6edf3",
    inputBg: isDark ? "#091022" : "#f8fafc",
    inputText: isDark ? "#e6eefc" : "#102a43",
    primary: isDark ? "#4f9fff" : "#0b84ff",
    success: "#18a558",
    danger: "#e05353",
    shadow: isDark ? "#071025" : "#e9f0ff",
  };

  // ---------- Sanitización de inputs ----------
  const sanitizeNumeric = (text: string, allowDecimal = false) => {
    if (text === "" || text === null) return "";
    let t = text.replace(",", ".");
    if (allowDecimal) {
      t = t.replace(/[^0-9.]/g, "");
      const parts = t.split(".");
      if (parts.length > 2) {
        t = parts[0] + "." + parts.slice(1).join("");
      }
      t = t.replace(/^0+(?=\d)/, "");
      if (t.startsWith(".")) t = "0" + t;
      return t === "" ? "0" : t;
    } else {
      t = t.replace(/\D/g, "");
      t = t.replace(/^0+(?=\d)/, "");
      return t === "" ? "0" : t;
    }
  };

  // ---------- Helpers de cálculo ----------
  const isNumericDenom = (key: string) => {
    const n = Number(key);
    return !isNaN(n) && Number.isFinite(n);
  };

  const calcularValor = (key: string, currentCantidades: CantidadesMap, rates: RatesMap): number => {
    const cantidad = parseInt(currentCantidades[key] || "0", 10) || 0;
    if (isNumericDenom(key)) {
      return cantidad * Number(key);
    } else if (EXCHANGE_KEYS.includes(key)) {
      return (parseFloat(currentCantidades[key] || "0") || 0) * (rates[key] || 0);
    } else if (key === "Transferencia") {
      return parseFloat(currentCantidades[key] || "0") || 0;
    } else {
      return 0;
    }
  };

  const calcularSumaDenominaciones = (currentCantidades: CantidadesMap, rates: RatesMap) => {
    const keys = DENOMINACIONES.filter((k) => String(k) !== "Transferencia");
    const total = keys.reduce((acc, k) => {
      return Number(acc) + calcularValor(String(k), currentCantidades, rates);
    }, 0);
    return total;
  };

  // Guarda DESGLOSE_DATA (totales, denominaciones y tasas)
  const saveDesgloseTotals = useCallback(
    async (currentCantidades: CantidadesMap, rates: RatesMap) => {
      try {
        const totalCaja = calcularSumaDenominaciones(currentCantidades, rates);
        const propina = parseFloat(currentCantidades["_PROPINA_OVERRIDE"] ?? propinaManual) || 0;
        const salario = propina + comisionNumber;
        const transferenciaNumber = parseFloat(currentCantidades["Transferencia"] || "0") || 0;
        const liquidacion = importeNumber - comisionNumber - transferenciaNumber;

        const payload = {
          meta: { savedAt: new Date().toISOString() },
          denominations: currentCantidades,
          exchangeRates: rates,
          totals: {
            totalCaja: Number(totalCaja).toFixed(2),
            propina,
            comision: Number(comisionNumber.toFixed(2)),
            salario: Number(salario.toFixed(2)),
            liquidacion: Number(liquidacion.toFixed(2)),
            importe: Number(importeNumber.toFixed(2)),
            transferencia: Number(transferenciaNumber.toFixed(2)),
          },
        };
        await AsyncStorage.setItem("DESGLOSE_DATA", JSON.stringify(payload));
      } catch (e) {
        console.warn("Error saving DESGLOSE_DATA:", e);
      }
    },
    [propinaManual, comisionNumber, importeNumber]
  );

  // Guarda CAJA_DATA (cantidades por denominación)
  const saveCantidades = async (key: string, value: string, allowDecimal = false) => {
    try {
      const sanitized = sanitizeNumeric(value, allowDecimal);
      const updated: CantidadesMap = { ...cantidades, [key]: sanitized };
      setCantidades(updated);
      await AsyncStorage.setItem("CAJA_DATA", JSON.stringify(updated));
      await saveDesgloseTotals(updated, exchangeRates);
    } catch (e) {
      console.warn("Error saving CAJA_DATA:", e);
    }
  };

  // Guarda propina manual (por si el usuario la cambia)
  const savePropinaManual = async (value: string) => {
    try {
      const sanitized = sanitizeNumeric(value, true);
      setPropinaManual(sanitized);
      const updated = { ...cantidades, ["_PROPINA_OVERRIDE"]: sanitized };
      setCantidades(updated);
      await AsyncStorage.setItem("CAJA_DATA", JSON.stringify(updated));
      await saveDesgloseTotals(updated, exchangeRates);
    } catch (e) {
      console.warn("Error saving propina:", e);
    }
  };

  // ---------- carga inicial ----------
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const loadData = async () => {
        setLoading(true);
        try {
          const rawCantidades = await AsyncStorage.getItem("CAJA_DATA");
          const parsedCant: CantidadesMap = rawCantidades ? JSON.parse(rawCantidades) : {};
          const rawDesglose = await AsyncStorage.getItem("DESGLOSE_DATA");
          const parsedDesglose = rawDesglose ? JSON.parse(rawDesglose) : null;

          const rates: RatesMap = {};
          for (const key of EXCHANGE_KEYS) {
            const raw = await AsyncStorage.getItem(`EXCHANGE_${key}`);
            rates[key] = raw ? parseFloat(raw) : 0;
          }

          if (parsedDesglose && parsedDesglose.exchangeRates) {
            for (const k of EXCHANGE_KEYS) {
              if (parsedDesglose.exchangeRates[k] !== undefined) {
                rates[k] = Number(parsedDesglose.exchangeRates[k]) || rates[k];
              }
            }
          }

          let inicialPropina = "0";
          if (parsedCant && parsedCant["_PROPINA_OVERRIDE"]) {
            inicialPropina = String(parsedCant["_PROPINA_OVERRIDE"]);
          } else if (parsedDesglose && parsedDesglose.totals && parsedDesglose.totals.propina !== undefined) {
            inicialPropina = String(parsedDesglose.totals.propina || 0);
          }

          const initialCant: CantidadesMap = { ...(parsedCant || {}) };
          for (const d of DENOMINACIONES) {
            const key = String(d);
            if (initialCant[key] === undefined) initialCant[key] = "0";
          }
          if (initialCant["Transferencia"] === undefined) initialCant["Transferencia"] = "0";

          if (mounted) {
            const sanitizedInitial: CantidadesMap = { ...initialCant };
            for (const k of Object.keys(sanitizedInitial)) {
              const allowDecimal = k === "Transferencia" || EXCHANGE_KEYS.includes(k);
              sanitizedInitial[k] = sanitizeNumeric(String(sanitizedInitial[k] ?? "0"), allowDecimal);
            }

            setCantidades(sanitizedInitial);
            setExchangeRates(rates);
            setPropinaManual(inicialPropina);
            await saveDesgloseTotals(sanitizedInitial, rates);
          }
        } catch (e) {
          console.warn("Error loading caja data:", e);
        } finally {
          if (mounted) setLoading(false);
        }
      };
      loadData();
      return () => {
        mounted = false;
      };
    }, [])
  );

  useEffect(() => {
    saveDesgloseTotals(cantidades, exchangeRates);
  }, [exchangeRates]);

  // cálculos en render
  const sumaDenominaciones = calcularSumaDenominaciones(cantidades, exchangeRates);
  const propina = parseFloat(propinaManual) || 0;
  const salario = propina + comisionNumber;
  const transferenciaNumber = parseFloat(cantidades["Transferencia"] || "0") || 0;
  const liquidacion = importeNumber - comisionNumber - transferenciaNumber;

  const muestraAlertaDesglose = Number(sumaDenominaciones) < Number(liquidacion);

  // Botón atrás
  async function saveDesglose(): Promise<void> {
    await saveDesgloseTotals(cantidades, exchangeRates);
    router.push({ pathname: "/(tabs)/final" });
  }
  async function back() {
    router.push({ pathname: "/(tabs)/final" });
  }

  const showInfo = (title: string, message: string) => {
    Alert.alert(title, message);
  };

  if (loading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 20 }}>
          {/* Header Card */}
          <View style={[styles.headerCard, { backgroundColor: themeColors.card, shadowColor: themeColors.shadow, borderColor: themeColors.border }]}>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>Ingresos por venta</Text>
            <Text style={[styles.headerValue, { color: themeColors.primary }]}>${Number(importeNumber.toFixed(2))}</Text>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroupCompact, { borderColor: themeColors.border }]}>
                <Text style={[styles.inputLabel, { color: themeColors.mutted }]}>Escriba su propina</Text>
                <TextInput
                  keyboardType={Platform.OS === "web" ? "numeric" : "number-pad"}
                  value={propinaManual}
                  onChangeText={savePropinaManual}
                  style={[styles.inputSmall, { backgroundColor: themeColors.inputBg, color: themeColors.inputText }]}
                  placeholder="0"
                  placeholderTextColor="#9aa6bf"
                />
              </View>

              <View style={[styles.inputGroupCompact, { borderColor: themeColors.border }]}>
                <Text style={[styles.inputLabel, { color: themeColors.mutted }]}>Dinero en transferencia</Text>
                <TextInput
                  keyboardType={Platform.OS === "web" ? "numeric" : "number-pad"}
                  value={cantidades["Transferencia"] ?? "0"}
                  onChangeText={(text) => saveCantidades("Transferencia", text, true)}
                  style={[styles.inputSmall, { backgroundColor: themeColors.inputBg, color: themeColors.inputText }]}
                  placeholder="0"
                  placeholderTextColor="#9aa6bf"
                />
              </View>
            </View>
          </View>

          {/* Inputs principales: Ganancia por productos y Salario */}
          <View style={[styles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.rowSmall}>
              <View style={styles.chip}>
                <Text style={[styles.chipLabel, { color: themeColors.mutted }]}>Ganancia por productos</Text>
                <Text style={[styles.chipValue, { color: themeColors.text }]}>${Number(comisionNumber.toFixed(2))}</Text>
              </View>

              <View style={styles.chip}>
                <Text style={[styles.totalLabel, { color: themeColors.mutted }]}>Salario</Text>
                <Text style={[styles.totalValue, { color: themeColors.primary }]}>${Number(salario.toFixed(2))}</Text>
              </View>
            </View>

            {/* Nota PROPINA + COMISIÓN = SALARIO (alineada debajo de ambas tarjetas) */}
            <View style={[styles.infoRow, { marginTop: 10 }]}>
              <TouchableOpacity onPress={() => showInfo("Salario", "Salario = Propina + Comisión. La propina puede venir del cajón o ingresarse manualmente.")}>
                <Text style={[styles.infoIcon, { color: themeColors.mutted }]}>ℹ️</Text>
              </TouchableOpacity>
              <Text style={[styles.noteLabel, { color: themeColors.mutted, flex: 1 }]}>
                PROPINA + COMISIÓN = SALARIO.
              </Text>
            </View>
          </View>

          {/* Totals Card */}
          <View style={[styles.totalsCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.totalsRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.totalLabel, { color: themeColors.mutted }]}>Total del desglose</Text>
                <Text style={[styles.totalValue, { color: themeColors.text }]}>${Number(sumaDenominaciones).toFixed(2)}</Text>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={[styles.totalLabel, { color: themeColors.mutted }]}>Liquidación</Text>
                <Text style={[styles.totalValue, { color: themeColors.primary }]}>${Math.max(Number(sumaDenominaciones), Number(liquidacion)).toFixed(2)}</Text>
              </View>
            </View>

            {/* Info de Liquidacion (debajo de ambos valores) */}
            <View style={[styles.infoRow, { marginTop: 8 }]}>
              <TouchableOpacity onPress={() => showInfo("Liquidación", "LIQUIDACIÓN = VENTA - GANANCIA - TRANSFERENCIA. Asegúrate de confirmar la transferencia registrada.")}>
                <Text style={[styles.infoIcon, { color: themeColors.mutted }]}>ℹ️</Text>
              </TouchableOpacity>
              <Text style={[styles.noteLabel, { color: themeColors.mutted, flex: 1 }]}>
                LIQUIDACIÓN = VENTA - GANANCIA - TRANSFERENCIA.
              </Text>
            </View>

            {muestraAlertaDesglose && (
              <View style={{ marginTop: 10, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: themeColors.danger, backgroundColor: isDark ? "#2b0f12" : "#fff6f6" }}>
                <Text style={{ color: themeColors.danger }}>
                  Alerta: la suma del desglose es menor que la liquidación. Verifica denominaciones o transferencia.
                </Text>
              </View>
            )}
          </View>

          {/* Desglose (2 columnas) */}
          <Text style={[styles.sectionHeader, { color: themeColors.text }]}>
            Desglose (<Link
              href="/(tabs)/ajustes"
              style={{
                color: themeColors.primary,
                fontSize: 14,
                marginBottom: 8
              }}
            >
              tocar aquí para ajustar valor de las divisas
            </Link>)
          </Text>


          <FlatList
            data={DENOMINACIONES.filter(item => String(item) !== "Transferencia")}
            keyExtractor={(item) => String(item)}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: "space-between", marginBottom: 8 }}
            renderItem={({ item }) => {
              const key = String(item);
              const displayRate = EXCHANGE_KEYS.includes(key) ? ` (tasa: ${exchangeRates[key] ?? 0})` : "";
              const allowDecimal = EXCHANGE_KEYS.includes(key);
              return (
                <View style={[
                  styles.denomCard,
                  {
                    backgroundColor: isDark ? "#071025" : "#fff",
                    borderColor: themeColors.primary,
                    shadowColor: themeColors.shadow,
                    shadowOpacity: 0.06,
                    elevation: 2,
                  }
                ]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.denomLabel, { color: themeColors.mutted }]}>
                      {key}{displayRate}
                    </Text>
                  </View>
                  <TextInput
                    keyboardType={Platform.OS === "web" ? "numeric" : "number-pad"}
                    value={cantidades[key] ?? "0"}
                    onChangeText={(text) => saveCantidades(key, text, allowDecimal)}
                    style={[
                      styles.denomInput,
                      {
                        color: themeColors.inputText,
                        borderWidth: 1,
                        borderColor: themeColors.primary,
                        backgroundColor: isDark ? "#0b1220" : "#fefefe"
                      }
                    ]}
                    placeholder="0"
                    placeholderTextColor="#9aa6bf"
                  />
                </View>
              );
            }}
            scrollEnabled={false}
          />

          {/* Footer Total and action */}
          <View style={{ marginTop: 10, marginBottom: 30 }}>
            <View style={[styles.footerRow, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <View>
                <Text style={[styles.footerLabel, { color: themeColors.mutted }]}>Total</Text>
                <Text style={[styles.footerValue, { color: themeColors.primary }]}>${Number(sumaDenominaciones).toFixed(2)}</Text>
              </View>
              <View style={{flexDirection:"row"}}>
                <TouchableOpacity
                  onPress={back}
                  style={[styles.button, { backgroundColor: themeColors.primary }]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buttonText}>Atrás</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveDesglose}
                  style={[styles.button, { backgroundColor: themeColors.success }]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buttonText}>Guardar</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  headerTitle: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  headerValue: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  rowSmall: { flexDirection: "row", justifyContent: "space-between", gap: 8 },

  chip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  chipLabel: { fontSize: 11 },
  chipValue: { fontSize: 15, fontWeight: "700", marginTop: 4 },

  section: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },

  inputRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  inputGroup: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1 },
  inputGroupCompact: { flex: 1, padding: 6, borderRadius: 8, borderWidth: 1 },
  inputLabel: { fontSize: 12, marginBottom: 6 },
  inputLarge: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    textAlign: "right",
    borderWidth: 0,
  },
  inputSmall: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 15,
    textAlign: "right",
    borderWidth: 0,
  },

  totalsCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  totalsRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 12 },
  totalValue: { fontSize: 20, fontWeight: "800" },
  noteLabel: { fontSize: 12, marginTop: 0 },

  sectionHeader: { fontSize: 15, fontWeight: "700", marginBottom: 8 },

  denomCard: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    marginHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  denomLabel: { fontSize: 13 },
  denomInput: {
    width: 80,
    height: 38,
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 15,
    textAlign: "right",
    borderWidth: 0,
  },

  footerRow: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLabel: { fontSize: 12 },
  footerValue: { fontSize: 20, fontWeight: "800" },

  button: {
    marginInline:3,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },

  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  // info row
  infoRow: { flexDirection: "row", alignItems: "center" },
  infoIcon: { fontSize: 18, marginRight: 8 },

  // small helpers
  totalLabelSmall: { fontSize: 11 },
  totalValueSmall: { fontSize: 16, fontWeight: "700" },
});
