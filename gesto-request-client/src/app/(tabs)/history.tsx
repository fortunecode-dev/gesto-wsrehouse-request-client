import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { format, parseISO } from "date-fns";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { fetchMovements } from "@/services/pedidos.service";
import { useAppTheme } from "@/providers/ThemeProvider";

interface Movement {
  unit: any;
  id: string;
  movementDate: string;
  itemName: string;
  quantity: number;
  toAreaId?: string;
}

interface MovementGroup {
  date: string;
  movements: Movement[];
}

export default function MovementsView() {
  const [data, setData] = useState<Movement[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [noLocalSelected, setNoLocalSelected] = useState(false);

  const { theme } = useAppTheme();
  const isDark = theme === "dark";

  const COLORS = {
    background: isDark ? "#111827" : "#f5f7fb",
    card: isDark ? "#1f2937" : "#ffffff",
    border: isDark ? "#374151" : "#e0e0e0",
    text: isDark ? "#f9fafb" : "#1e293b",
    textSecondary: isDark ? "#9ca3af" : "#64748b",
    inputBg: isDark ? "#1f2937" : "#ffffff",
    inputBorder: isDark ? "#4b5563" : "#d1d5db",
    placeholder: isDark ? "#6b7280" : "#94a3b8",
    accent: isDark ? "#60a5fa" : "#2563eb",
    entrada: "#22c55e",
    salida: "#ef4444",
  };

  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    try {
      const areaId = await AsyncStorage.getItem("selectedLocal");
      if (!areaId) {
        setNoLocalSelected(true);
        setData([]);
        return;
      }

      setSelectedArea(areaId);
      setNoLocalSelected(false);

      const movements = await fetchMovements();
      setData(movements);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMovements();
    }, [loadMovements])
  );

  const filteredData = useMemo(() => {
    return data.filter((m) =>
      m.itemName.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  const groupedData: MovementGroup[] = useMemo(() => {
    const groups: Record<string, Movement[]> = {};
    filteredData.forEach((m) => {
      const dateKey = format(parseISO(m.movementDate), "yyyy-MM-dd");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(m);
    });
    return Object.keys(groups)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => ({ date, movements: groups[date] }));
  }, [filteredData]);

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (noLocalSelected) {
    return (
      <View style={[styles.loader, { backgroundColor: COLORS.background }]}>
        <Text
          style={{
            fontSize: 16,
            color: COLORS.textSecondary,
            textAlign: "center",
          }}
        >
          No hay un local seleccionado. Por favor selecciona un local para ver los movimientos.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      <TextInput
        placeholder="Buscar producto..."
        placeholderTextColor={COLORS.placeholder}
        style={[
          styles.searchInput,
          {
            backgroundColor: COLORS.inputBg,
            borderColor: COLORS.inputBorder,
            color: COLORS.text,
          },
        ]}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={groupedData}
        keyExtractor={(item) => item.date}
        renderItem={({ item }) => (
          <View style={styles.dateGroup}>
            <View style={styles.dateHeaderRow}>
              <Text style={[styles.dateHeader, { color: COLORS.text }]}>
                {format(parseISO(item.date), "dd MMM yyyy")}
              </Text>
              <Text style={[styles.dateHeader, { color: COLORS.text }]}>
                Cantidad
              </Text>
            </View>

            {item.movements.map((m) => {
              const isEntrada = selectedArea === m.toAreaId;

              return (
                <View
                  key={m.id}
                  style={[
                    styles.movementRow,
                    {
                      backgroundColor: COLORS.card,
                      borderColor: COLORS.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, { color: COLORS.text }]}>
                      {m.itemName}
                    </Text>

                    <Text style={[styles.itemTime, { color: COLORS.textSecondary }]}>
                      {format(parseISO(m.movementDate), "HH:mm")}
                    </Text>
                  </View>

                  {/* BADGE DE ENTRADA / SALIDA */}
                  <View
                    style={{
                      paddingVertical: 4,
                      paddingHorizontal: 10,
                      borderRadius: 8,
                      backgroundColor: isEntrada ? COLORS.entrada : COLORS.salida,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontWeight: "800",
                        fontSize: 14,
                      }}
                    >
                      {isEntrada ? "Entrada" : "Salida"}
                    </Text>
                  </View>

                  <Text style={[styles.quantity, { color: COLORS.accent, marginLeft: 12 }]}>
                    {Number(m.quantity).toFixed(2)} {m?.unit?.abbreviation || ""}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  searchInput: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    fontSize: 16,
  },
  dateGroup: { marginBottom: 16 },
  dateHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  dateHeader: { fontSize: 16, fontWeight: "700" },
  movementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  itemName: { fontSize: 14, fontWeight: "600" },
  itemTime: { fontSize: 12 },
  quantity: { fontSize: 16, fontWeight: "700" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
});
