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

interface Movement {
  unit: any;
  id: string;
  movementDate: string;
  itemName: string;
  quantity: number;
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

  const loadMovements = useCallback(async () => {
    setLoading(true);
    try {
      const areaId = await AsyncStorage.getItem("selectedLocal");
      if (!areaId) {
        setNoLocalSelected(true);
        setData([]);
        return;
      }

      setNoLocalSelected(false);
      const movements = await fetchMovements();
      setData(movements);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresca cada vez que la pantalla recibe foco
  useFocusEffect(
    useCallback(() => {
      loadMovements();
    }, [loadMovements])
  );

  // Filtrar movimientos por búsqueda
  const filteredData = useMemo(() => {
    return data.filter((m) =>
      m.itemName.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  // Agrupar por fecha (YYYY-MM-DD)
  const groupedData: MovementGroup[] = useMemo(() => {
    const groups: Record<string, Movement[]> = {};
    filteredData.forEach((m) => {
      const dateKey = format(parseISO(m.movementDate), "yyyy-MM-dd");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(m);
    });
    return Object.keys(groups)
      .sort((a, b) => (a < b ? 1 : -1)) // fechas descendentes
      .map((date) => ({ date, movements: groups[date] }));
  }, [filteredData]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#0b84ff" />
      </View>
    );
  }

  if (noLocalSelected) {
    return (
      <View style={styles.loader}>
        <Text style={{ fontSize: 16, color: "#888", textAlign: "center" }}>
          No hay un local seleccionado. Por favor selecciona un local para ver los movimientos.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Buscar producto..."
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#888"
      />

      <FlatList
        data={groupedData}
        keyExtractor={(item) => item.date}
        renderItem={({ item }) => (
          <View style={styles.dateGroup}>
            <View style={styles.dateHeaderRow}>
              <Text style={styles.dateHeader}>
                {format(parseISO(item.date), "dd MMM yyyy")}
              </Text>
              <Text style={styles.dateHeader}>
               Cantidad
              </Text>
            </View>

            {item.movements.map((m) => (
              <View key={m.id} style={styles.movementRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{m.itemName}</Text>
                  <Text style={styles.itemTime}>
                    {format(parseISO(m.movementDate), "HH:mm")}
                  </Text>
                </View>
                <Text style={styles.quantity}>
                  {Math.round(m.quantity)} {m?.unit?.abbreviation || ""}
                </Text>
              </View>
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: "#f5f7fb" },
  searchInput: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  dateGroup: { marginBottom: 16 },
  dateHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  dateHeader: { fontSize: 16, fontWeight: "700" },
  totalDateQuantity: { fontSize: 16, fontWeight: "700", color: "#0b84ff" },
  movementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  itemName: { fontSize: 14, fontWeight: "600" },
  itemTime: { fontSize: 12, color: "#888" },
  quantity: { fontSize: 16, fontWeight: "700" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
});
