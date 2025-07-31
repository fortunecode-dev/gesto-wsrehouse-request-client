import {
  activateRequest,
  getProductsSaved,
  makeMovement,
  postFinal,
  postInicial,
  syncProducts
} from "@/services/pedidos.service";
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const standar = { mass: "g", units: "u", volume: "mL", distance: "cm" };
const cantidadRegex = /^\d*\.?\d{0,2}$/;

export default function Basket({ title, url }) {
  const [productos, setProductos] = useState([]);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [hasReported, setHasReported] = useState(false); // Nuevo
  const inputsRef = useRef([]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [url])
  );

  const load = async () => {
    try {
          const areaId = await AsyncStorage.getItem('selectedLocal');
    const userId = await AsyncStorage.getItem('selectedResponsable');
    if (areaId == null || userId===null)
      return router.push({ pathname: "/" })

      let saved = await getProductsSaved(url);
      setProductos([...saved]);
      const algunoReportado = saved.some(p => !!p.reported); // Verificación de reported
      setHasReported(algunoReportado);
    } catch (e) {
      Alert.alert("Error cargando los productos", e)
    }
  };

  useEffect(() => {
    if (!productos?.length) return;
    const timer = setTimeout(async () => {
      try {
        setSyncStatus("loading");
        await syncProducts(url, productos);
        setSyncStatus("success");
      } catch (error) {
        console.error("Sync error:", error);
        setSyncStatus("error");
      } finally {
        setTimeout(() => setSyncStatus("idle"), 500);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [productos]);

  const actualizarCantidad = (id, nuevaCantidad) => {
    if (!cantidadRegex.test(nuevaCantidad)) return;
    if (url === "checkout") setHasReported(false)
    setProductos(prev =>
      prev.map(p =>
        p.id === id ? { ...p, quantity: nuevaCantidad } : p
      )
    );
  };

  const handleSubmit = (index) => {
    if (index + 1 < productos.length) {
      inputsRef.current[index + 1]?.focus();
    } else {
      Keyboard.dismiss();
    }
  };

  const renderSyncStatus = () => {
    switch (syncStatus) {
      case "loading":
        return <ActivityIndicator size="small" color="#3498db" />;
      case "success":
        return <MaterialIcons name="check" size={18} color="#2ecc71" />;
      case "error":
        return <MaterialIcons name="error" size={18} color="#e74c3c" />;
      default:
        return null;
    }
  };

  const getContainerStyle = (item) => {
    const quantity = parseFloat(item.quantity || '0');
    const stock = parseFloat(item.stock ?? '');
    if (isNaN(stock) || quantity === 0) return styles.productoContainer;
    if (quantity > stock) return [styles.productoContainer, styles.containerRed];
    return [styles.productoContainer, styles.containerGreen];
  };

  const hayExcesoDeCantidad = productos.some(p => {
    const qty = parseFloat(p.quantity || '0');
    const stk = parseFloat(p.stock ?? '0');
    return qty > stk;
  });

  const ejecutarAccion = (accion) => {
    switch (accion) {
      case "Guardar Inicial":
        postInicial()
          .then(() => {
            Alert.alert('Guardar cantidades iniciales', 'Se guardaron las cantidades iniciales')
            setHasReported(true)
          })
          .catch((e) => Alert.alert('Error guardando cantidades iniciales', e));
        break;
      case "Enviar Pedido":
        activateRequest()
          .then(() => {
            Alert.alert('Pedido enviado')
            setHasReported(true)
          })
          .catch((e) => Alert.alert('Error enviando el pedido', e));
        break;
      case "Guardar Final":
        postFinal()
          .then(() => Alert.alert('Guardar cantidades finales', 'Se guardaron correctamente'))
          .catch((e) => Alert.alert('Error al guardar finales', e))
          .finally(() => {
            router.push({ pathname: "/" });
            AsyncStorage.removeItem("selectedLocal");
            AsyncStorage.removeItem("selectedResponsable");
          });
        break;
      default:
        console.warn("Acción desconocida");
    }
  };

  const handleAction = (accion) => {
    Alert.alert(
      "CONFIRMAR",
      `DESEA ${accion.toUpperCase()}?`,
      [
        { text: "CANCELAR", style: "cancel" },
        {
          text: "CONFIRMAR",
          onPress: () => ejecutarAccion(accion),
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.buttonsRow}>
          <View style={styles.syncIcon}>{renderSyncStatus()}</View>
          <TouchableOpacity onPress={load} style={styles.actionButton}>
            <Text style={styles.actionText}>Actualizar</Text>
          </TouchableOpacity>

          {url === 'initial' && (
            <TouchableOpacity
              onPress={() => !hasReported && handleAction("Guardar Inicial")}
              style={[styles.actionButton, hasReported && styles.disabledButton]}
              disabled={hasReported}
            >
              <Text style={[styles.actionText, hasReported && styles.disabledText]}>
                {hasReported ? "Reportado" : "Guardar Inicial"}
              </Text>
            </TouchableOpacity>
          )}

          {url === 'request' && (
            <TouchableOpacity onPress={() => !hasReported && handleAction("Enviar Pedido")} style={[styles.actionButton, hasReported && styles.disabledButton]}
              disabled={hasReported}>
              <Text style={[styles.actionText, hasReported && styles.disabledText]}>{hasReported ? "En espera" : "Confirmar Pedido"}</Text>
            </TouchableOpacity>
          )}

          {url === 'checkout' && (
            <TouchableOpacity
              onPress={() => (!hayExcesoDeCantidad && hasReported) && handleAction("Mover al área")}
              style={[styles.actionButton, (hayExcesoDeCantidad || !hasReported) && styles.disabledButton]}
              disabled={hayExcesoDeCantidad || !hasReported}
            >
              <Text style={[styles.actionText, (hayExcesoDeCantidad || !hasReported) && styles.disabledText]}>
                {hayExcesoDeCantidad ? "Stock insuficiente" : !hasReported ? "Esperando aprovación" : "Mover al área"}
              </Text>
            </TouchableOpacity>
          )}

          {url === 'final' && (
            <TouchableOpacity onPress={() => handleAction("Guardar Final")} style={styles.actionButton}>
              <Text style={styles.actionText}>Guardar Final</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {(hayExcesoDeCantidad && url === "checkout") && (
        <Text style={styles.warningText}>⚠️ Cantidad mayor al stock en algunos productos.</Text>
      )}

      {productos?.map((item, index) => (
        <View key={item.id} style={getContainerStyle(item)}>
          <View style={styles.row}>
            <View style={styles.infoLeft}>
              <Text style={styles.nombre}>
                {item.name} ({standar[item.unitOfMeasureId]})
              </Text>
              {!!item.stock && <Text style={styles.stock}>Stock: {item.stock}</Text>}
              {item.stock === 0 && <Text style={styles.stock}>Sin existencia</Text>}
              {!!item.netContent && (
                <Text style={styles.stock}>
                  Contenido neto: {item.netContent} {standar[item.netContentUnitOfMeasureId]}
                </Text>
              )}
            </View>
            <TextInput
              ref={(ref) => { if (ref) inputsRef.current[index] = ref }}
              style={styles.input}
              keyboardType="decimal-pad"
              editable={!((url === 'initial' || url === 'request') && hasReported)}
              value={item.quantity?.toString() || ""}
              onChangeText={(text) => actualizarCantidad(item.id, text)}
              onSubmitEditing={() => handleSubmit(index)}
              placeholder="Cantidad"
              placeholderTextColor="#888"
              returnKeyType="next"
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: "#f2f2f2",
    paddingTop: Platform.OS === "ios" ? 20 : 10,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 25,
    marginBottom: 10,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
    flex: 1,
  },
  buttonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
    alignItems: "center",
    flex: 2,
  },
  actionButton: {
    backgroundColor: "#3498db",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  actionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  syncIcon: {
    marginLeft: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    backgroundColor: "#bdc3c7",
  },
  disabledText: {
    color: "#7f8c8d",
  },
  warningText: {
    color: "#e67e22",
    fontSize: 13,
    marginBottom: 8,
    fontWeight: "600",
  },
  productoContainer: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  containerRed: {
    borderColor: "#e74c3c",
    backgroundColor: "#fdecea",
  },
  containerGreen: {
    borderColor: "#2ecc71",
    backgroundColor: "#eafaf1",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoLeft: {
    flex: 1,
    marginRight: 10,
  },
  nombre: {
    fontSize: 14,
    fontWeight: "500",
    color: "#34495e",
    marginBottom: 2,
  },
  stock: {
    fontSize: 12,
    color: "#7f8c8d",
  },
  input: {
    width: 80,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: "#fafafa",
    textAlign: "right",
    color: "#2c3e50",
  },
});
