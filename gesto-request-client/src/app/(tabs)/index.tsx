import {
  getAreas,
  getEmployes,
  getObservation,
  getRequestId,
  saveObservation
} from "@/services/pedidos.service";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useTheme } from "react-native-paper";

interface Area {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  username: string;
}

export default function LocalScreen() {
  const [selectedLocal, setSelectedLocal] = useState<string>('');
  const [areas, setAreas] = useState<Area[]>([]);
  const [responsables, setResponsables] = useState<Employee[]>([]);
  const [selectedResponsable, setSelectedResponsable] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingEmployees, setLoadingEmployees] = useState<boolean>(false);
  const [observation, setObservation] = useState<string>('');
  const [savingObs, setSavingObs] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [localModalVisible, setLocalModalVisible] = useState<boolean>(false);
  const [responsableModalVisible, setResponsableModalVisible] = useState<boolean>(false);
  const { colors } = useTheme();

  const selectedLocalName = areas.find(a => a.id === selectedLocal)?.name;
  const selectedResponsableName = responsables.find(r => r.id === selectedResponsable)?.username;

  useFocusEffect(
    useCallback(() => {
      const loadInitialData = async () => {
        try {
          setLoading(true);
          const locals = await getAreas();
          setAreas(locals);

          const savedLocal = await AsyncStorage.getItem('selectedLocal');
          const savedResponsable = await AsyncStorage.getItem('selectedResponsable');
          console.log("selectedLocal",selectedLocal)
          if(selectedLocal)  await AsyncStorage.setItem('selectedLocal',selectedLocal);
          if(selectedResponsable)  await AsyncStorage.setItem('selectedResponsable',selectedResponsable);

          if (savedLocal) {
            setSelectedLocal(savedLocal);

            const employees = await getEmployes(savedLocal);
            setResponsables(employees);

            if (savedResponsable) {
              setSelectedResponsable(savedResponsable);
            }
          }
        } catch (error) {
          setError(String(error));
          console.error("Error loading initial data:", error);
        } finally {
          setLoading(false);
        }
      };

      loadInitialData();
    }, [])
  );

  useEffect(() => {
    const loadEmployees = async () => {
      if (!selectedLocal) return;

      try {
        setLoadingEmployees(true);
        const employees = await getEmployes(selectedLocal);
        setResponsables(employees);
        await AsyncStorage.setItem('selectedLocal', selectedLocal);
        setSelectedResponsable('');
        await AsyncStorage.removeItem('selectedResponsable');
        setObservation('');
      } catch (error) {
        console.error("Error loading employees:", error);
      } finally {
        setLoadingEmployees(false);
      }
    };

    loadEmployees();
  }, [selectedLocal]);

  useEffect(() => {
    const loadResponsableData = async () => {
      if (!selectedResponsable) return;

      try {
        await AsyncStorage.setItem('selectedResponsable', selectedResponsable);
        await getRequestId(selectedResponsable, selectedLocal);

        const obs = await getObservation(selectedResponsable, selectedLocal);
        setObservation(obs || '');
      } catch (error) {
        console.error("Error cargando datos del responsable:", error);
      }
    };

    loadResponsableData();
  }, [selectedResponsable]);

  const handleSaveObservation = async () => {
    try {
      setSavingObs(true);
      await saveObservation(selectedResponsable, selectedLocal, observation);
    } catch (e) {
      console.error("Error guardando observación:", e);
    } finally {
      setSavingObs(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>
        Seleccione Local
      </Text>

      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => setLocalModalVisible(true)}
      >
        <Text style={styles.selectorButtonText}>
          {selectedLocalName || "Selecciona un local"}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={localModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLocalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <FlatList
              data={areas}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedLocal(item.id);
                    setLocalModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              onPress={() => setLocalModalVisible(false)}
              style={styles.closeModalButton}
            >
              <Text style={styles.closeModalButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {selectedLocal && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            Responsable
          </Text>

          {loadingEmployees ? (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.selectorButton}
                onPress={() => setResponsableModalVisible(true)}
              >
                <Text style={styles.selectorButtonText}>
                  {selectedResponsableName || "Selecciona un responsable"}
                </Text>
              </TouchableOpacity>

              <Modal
                visible={responsableModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setResponsableModalVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <FlatList
                      data={responsables}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.modalItem}
                          onPress={() => {
                            setSelectedResponsable(item.id);
                            setResponsableModalVisible(false);
                          }}
                        >
                          <Text style={styles.modalItemText}>{item.username}</Text>
                        </TouchableOpacity>
                      )}
                    />
                    <TouchableOpacity
                      onPress={() => setResponsableModalVisible(false)}
                      style={styles.closeModalButton}
                    >
                      <Text style={styles.closeModalButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            </>
          )}

          {selectedResponsable && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                Observación
              </Text>
              <View style={styles.textAreaContainer}>
                <TextInput
                  multiline
                  numberOfLines={4}
                  style={styles.textArea}
                  placeholder="Escriba aquí su observación..."
                  value={observation}
                  onChangeText={setObservation}
                />
              </View>
              <TouchableOpacity
                onPress={handleSaveObservation}
                style={styles.saveButton}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8f9fa',
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
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderColor: '#dfe6e9',
    borderWidth: 1,
    marginBottom: 15,
  },
  selectorButtonText: {
    fontSize: 16,
    color: '#2d3436',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
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
    backgroundColor: '#d63031',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  textAreaContainer: {
    borderColor: '#dfe6e9',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#fff',
    padding: 8,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    fontSize: 16,
    color: '#2d3436',
  },
  saveButton: {
    backgroundColor: '#0984e3',
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
});
