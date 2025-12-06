import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAreas, getEmployes } from "@/services/pedidos.service";

interface Area {
  id: string;
  name: string;
  local: { name: string };
}

interface Employee {
  id: string;
  username: string;
}

export default function ModalSeleccionLocal({
  visible,
  onClose,
  onConfirm,
  actualArea
}: {
  actualArea: string,
  visible: boolean;
  onClose: () => void;
  onConfirm: (localId: string, responsableId: string) => void;
}) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [responsables, setResponsables] = useState<Employee[]>([]);

  const [selectedArea, setSelectedArea] = useState("");
  const [selectedToResponsable, setSelectedToResponsable] = useState("");

  const [loadingAreas, setLoadingAreas] = useState(true);
  const [loadingResponsables, setLoadingResponsables] = useState(false);

  // ================================
  // Cargar datos guardados
  // ================================
  useEffect(() => {
    if (!visible) return;

    const load = async () => {
      setLoadingAreas(true);
      const a = await getAreas();
      setAreas(a);

      const savedArea = (await AsyncStorage.getItem("selectedToLocal")) || "";
      const savedResponsable =
        (await AsyncStorage.getItem("selectedToResponsable")) || "";

      if (savedArea) {
        setSelectedArea(savedArea);
        setLoadingResponsables(true);
        const emps = await getEmployes(savedArea);
        setResponsables(emps);
        setSelectedToResponsable(savedResponsable);
        setLoadingResponsables(false);
      }

      setLoadingAreas(false);
    };

    load();
  }, [visible]);

  // ================================
  // Cargar empleados al seleccionar área
  // ================================
  const handleSelectArea = async (areaId: string) => {
    setSelectedArea(areaId);
    setSelectedToResponsable("");
    setLoadingResponsables(true);
    const emps = await getEmployes(areaId);
    setResponsables(emps);
    setLoadingResponsables(false);
  };

  // ================================
  // Guardar selección
  // ================================
  const handleConfirm = async () => {
    await AsyncStorage.setItem("selectedToLocal", selectedArea);
    await AsyncStorage.setItem("selectedToResponsable", selectedToResponsable);
    onConfirm(selectedArea, selectedToResponsable);
  };
  const sortedAreas = useMemo(() => {
    console.log(actualArea);
    return [...(areas ?? [])].sort((a, b) => {
      const localA = a.local?.name?.toLowerCase() ?? "";
      const localB = b.local?.name?.toLowerCase() ?? "";

      if (localA > localB) return -1;
      if (localA < localB) return 1;

      // Si los locales son iguales → ordenar por nombre del área
      const areaA = a.name?.toLowerCase() ?? "";
      const areaB = b.name?.toLowerCase() ?? "";

      if (areaA < areaB) return -1;
      if (areaA > areaB) return 1;

      return 0;
    }).filter(item => item.id != actualArea)
  }, [areas, actualArea]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Seleccionar Área y Responsable</Text>

          {/* SELECT ÁREA */}
          <Text style={styles.label}>Área</Text>
          {loadingAreas ? (
            <ActivityIndicator />
          ) : (
            <FlatList
              style={styles.list}
              data={sortedAreas}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.item,
                    selectedArea === item.id && styles.selectedItem,
                  ]}
                  onPress={() => handleSelectArea(item.id)}
                >
                  <Text style={styles.itemText}>
                    {item.local?.name} - {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}

          {/* SELECT RESPONSABLE */}
          {selectedArea !== "" && (
            <>
              <Text style={styles.label}>Responsable</Text>
              {loadingResponsables ? (
                <ActivityIndicator />
              ) : (
                <FlatList
                  style={styles.list}
                  data={responsables}
                  keyExtractor={(e) => e.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.item,
                        selectedToResponsable === item.id &&
                        styles.selectedItem,
                      ]}
                      onPress={() => setSelectedToResponsable(item.id)}
                    >
                      <Text style={styles.itemText}>{item.username}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </>
          )}

          {/* BOTONES */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.accept,
                !(selectedArea && selectedToResponsable) &&
                { opacity: 0.5 },
              ]}
              disabled={!(selectedArea && selectedToResponsable)}
              onPress={handleConfirm}
            >
              <Text style={styles.acceptText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    maxHeight: "85%",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 10,
  },
  list: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginTop: 5,
  },
  item: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  selectedItem: {
    backgroundColor: "#e2e8f0",
  },
  itemText: {
    fontSize: 16,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  cancel: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#ef4444",
  },
  cancelText: {
    color: "#fff",
    fontWeight: "600",
  },
  accept: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#2563EB",
  },
  acceptText: {
    color: "#fff",
    fontWeight: "600",
  },
});
