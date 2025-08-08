import {
  getAreas,
  getEmployes,
  getObservation,
  saveObservation,
} from "@/services/pedidos.service";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View, Image
} from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";

interface Area {
  id: string;
  name: string;
  local: { name: string };
}

interface Employee {
  id: string;
  username: string;
}

export default function LocalScreen() {
  const [selectedLocal, setSelectedLocal] = useState<string>('');
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [responsables, setResponsables] = useState<Employee[]>([]);
  const [selectedResponsable, setSelectedResponsable] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingEmployees, setLoadingEmployees] = useState<boolean>(false);
  const [observation, setObservation] = useState<string>('');
  const [savingObs, setSavingObs] = useState<boolean>(false);
  const [localModalVisible, setLocalModalVisible] = useState<boolean>(false);
  const [responsableModalVisible, setResponsableModalVisible] = useState<boolean>(false);
  const { theme } = useAppTheme();
  const isDark = theme === "dark";
  const [helpVisible, setHelpVisible] = useState(false);

  const themeColors = {
    background: isDark ? "#111827" : "#f8f9fa",
    card: isDark ? "#1f2937" : "#ffffff",
    text: isDark ? "#f9fafb" : "#2d3436",
    border: isDark ? "#374151" : "#dfe6e9",
    inputBg: isDark ? "#1f2937" : "#ffffff",
    inputText: isDark ? "#f3f4f6" : "#2d3436",
    primary: isDark ? "#60A5FA" : "#2563EB",
    danger: isDark ? "#ef4444" : "#d63031",
  };
  const help = {
    title: "¿Cómo llenar los campos?",
    image: require("../../../assets/ayudaInicial.png"),
    content: [
      {
        subtitle: "Cantidad",
        content: "Indique la cantidad exacta de unidades disponibles del producto."
      },
      {
        subtitle: "Stock",
        content: "El sistema validará que la cantidad no supere el stock permitido."
      }
    ]
  }
  const selectedLocalName = areas?.find(a => a.id === selectedLocal)?.name;
  const selectedResponsableName = responsables?.find(r => r.id === selectedResponsable)?.username;

  const showAlert = (title: string, message: any) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, String(message));
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadInitialData = async () => {
        try {
          setLoading(true);
          const locals = await getAreas();
          setAreas(locals);
          const savedLocal = await AsyncStorage.getItem('selectedLocal') ?? "";
          const savedResponsable = await AsyncStorage.getItem('selectedResponsable') ?? "";
          if (savedLocal) {
            const employees = await getEmployes(savedLocal);
            setResponsables(employees);
          }
          setSelectedResponsable(savedResponsable);
          setSelectedLocal(savedLocal);
        } catch (error) {
          showAlert("Error cargando los datos:", error);
        } finally {
          setLoading(false);
        }
      };
      loadInitialData();
    }, [])
  );

  useEffect(() => {
    const loadEmployees = async () => {
      if (!selectedLocal) {
        await AsyncStorage.removeItem('selectedLocal');
        await AsyncStorage.removeItem('selectedResponsable');
        return setResponsables([]);
      }
      try {
        setLoadingEmployees(true);
        await AsyncStorage.removeItem('selectedResponsable');
        await AsyncStorage.setItem('selectedLocal', selectedLocal);
        const employees = await getEmployes(selectedLocal);
        setResponsables([...employees]);
        setSelectedResponsable('');
        setObservation('');
      } catch (error) {
        showAlert("Error obteniendo los empleados:", error);
      } finally {
        setLoadingEmployees(false);
      }
    };
    loadEmployees();
  }, [selectedLocal]);

  useEffect(() => {
    const loadResponsableData = async () => {
      if (!selectedResponsable) {
        await AsyncStorage.removeItem('selectedResponsable');
        setObservation("");
        return;
      }
      try {
        await AsyncStorage.removeItem('requestId');
        await AsyncStorage.setItem('selectedResponsable', selectedResponsable);
        const data = await getObservation(selectedLocal);
        setObservation(data.observation || '');
      } catch (error) {
        showAlert("Error cargando datos del responsable", error);
      }
    };
    loadResponsableData();
  }, [selectedResponsable]);

  const handleSaveObservation = async () => {
    try {
      setSavingObs(true);
      await saveObservation(selectedResponsable, selectedLocal, observation);
    } catch (e) {
      showAlert("Error guardando la observación", e);
    } finally {
      setSavingObs(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: themeColors.background }]}>
      {areas ? (
        <>
          <Text style={[styles.sectionTitle, { color: themeColors.primary }]}>
            Seleccione su área
          </Text>
          <TouchableOpacity
            style={[styles.selectorButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
            onPress={() => setLocalModalVisible(true)}
          >
            <Text style={[styles.selectorButtonText, { color: themeColors.text }]}>
              {selectedLocalName || "Toque para ver las áreas"}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={[styles.sectionTitle, { color: themeColors.primary }]}>
          No se pudieron cargar las áreas, revise su conexión
        </Text>
      )}

      {selectedLocal && (
        <>
          <Text style={[styles.sectionTitle, { color: themeColors.primary }]}>
            Responsable
          </Text>
          {loadingEmployees ? (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator size="small" color={themeColors.primary} />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.selectorButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              onPress={() => setResponsableModalVisible(true)}
            >
              <Text style={[styles.selectorButtonText, { color: themeColors.text }]}>
                {selectedResponsableName || "Selecciona un responsable"}
              </Text>
            </TouchableOpacity>
          )}

          {selectedResponsable && (
            <>
              <Text style={[styles.sectionTitle, { color: themeColors.primary }]}>
                Observación
              </Text>
              <View style={[styles.textAreaContainer, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                <TextInput
                  multiline
                  numberOfLines={4}
                  style={[styles.textArea, { color: themeColors.inputText }]}
                  placeholder="Escriba aquí su observación..."
                  placeholderTextColor={isDark ? "#9CA3AF" : "#6b7280"}
                  value={observation}
                  onChangeText={setObservation}
                />
              </View>
              <TouchableOpacity
                onPress={handleSaveObservation}
                style={[styles.saveButton, { backgroundColor: themeColors.primary }]}
                disabled={savingObs}
              >
                <Text style={styles.saveButtonText}>
                  {savingObs ? 'Guardando...' : 'Guardar Observación'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      {/* MODALES */}
      <Modal
        visible={responsableModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setResponsableModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <FlatList
              data={responsables ?? []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedResponsable(item.id);
                    setResponsableModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, { color: themeColors.text }]}>
                    {item.username}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              onPress={() => setResponsableModalVisible(false)}
              style={[styles.closeModalButton, { backgroundColor: themeColors.danger }]}
            >
              <Text style={styles.closeModalButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* MODAL DE AYUDA */}
      <Modal visible={helpVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>{help.title}</Text>
            <Image source={help.image} style={{ width: '100%', height: 200, marginVertical: 12, resizeMode: 'contain' }} />
            {help.content.map((section, idx) => (
              <View key={idx} style={{ marginBottom: 12 }}>
                <Text style={{ fontWeight: '600', color: themeColors.text }}>{section.subtitle}</Text>
                <Text style={{ color: themeColors.text }}>{section.content}</Text>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => setHelpVisible(false)}
              style={[styles.actionButton, { backgroundColor: themeColors.danger, marginTop: 10 }]}
            >
              <Text style={styles.actionText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={localModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLocalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <FlatList
              data={areas ?? []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedLocal(item.id);
                    setLocalModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, { color: themeColors.text }]}>
                    {item.local?.name} - {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              onPress={() => setLocalModalVisible(false)}
              style={[styles.closeModalButton, { backgroundColor: themeColors.danger }]}
            >
              <Text style={styles.closeModalButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: {
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 15,
  },
  selectorButton: {
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 15,
  },
  selectorButtonText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    margin: 20,
    borderRadius: 10,
    padding: 15,
    maxHeight: '70%',
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
  },
  modalItemText: {
    fontSize: 16,
  },
  closeModalButton: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  textAreaContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    padding: 8,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  saveButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    borderRadius: 12,
    padding: 16,
  },modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  }, actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },  actionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
