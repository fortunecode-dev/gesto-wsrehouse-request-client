import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageSourcePropType,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useAppTheme } from "@/providers/ThemeProvider";

import {
  activateRequest,
  getProductsSaved,
  postFinal,
  postInicial,
  syncProducts,
} from "@/services/pedidos.service";

const standar = { mass: "g", units: "u", volume: "mL", distance: "cm" };
const cantidadRegex = /^\d*\.?\d{0,2}$/;

interface BasketProps {
  title: string;
  url: string;
  help: {
    title: string;
    image: ImageSourcePropType;
    content: { subtitle: string; content: string }[];
  };
}

export default function Basket({ title, url, help }: BasketProps) {
  const [productos, setProductos] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [hasReported, setHasReported] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const inputsRef = useRef<any[]>([]);

  const { theme } = useAppTheme();
  const isDark = theme === "dark";
  const themeColors = {
    background: isDark ? "#111827" : "#f2f2f2",
    card: isDark ? "#1f2937" : "#ffffff",
    text: isDark ? "#f9fafb" : "#2c3e50",
    border: isDark ? "#374151" : "#e0e0e0",
    inputBg: isDark ? "#1f2937" : "#fafafa",
    inputText: isDark ? "#f3f4f6" : "#2c3e50",
    primary: isDark ? "#60A5FA" : "#3498db",
    success: "#2ecc71",
    danger: "#e74c3c",
    warning: "#e67e22",
    disabled: isDark ? "#4b5563" : "#bdc3c7",
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [url])
  );

  const load = async () => {
    try {

      const areaId = await AsyncStorage.getItem("selectedLocal");
      const userId = await AsyncStorage.getItem("selectedResponsable");
      if (!areaId || !userId) return router.push({ pathname: "/" });

      const saved = await getProductsSaved(url);
      setProductos([...saved]);
      setHasReported(saved.some((p) => !!p.reported));
    } catch (e) {
      Alert.alert("Error cargando los productos", String(e));
    }
  };

  useEffect(() => {
    if (!productos?.length) return;
    const timer = setTimeout(async () => {
      try {
        setSyncStatus("loading");
        await syncProducts(url, productos);
        url === 'final' && await load()
        setSyncStatus("success");
      } catch (error) {
        setSyncStatus("error");
      } finally {
        setTimeout(() => setSyncStatus("idle"), 500);
      }
    }, url === 'final' ? 200 : 500);
    return () => clearTimeout(timer);
  }, [productos]);

  const actualizarCantidad = (id: string, nuevaCantidad: string) => {
    if (!cantidadRegex.test(nuevaCantidad)) return;
    if (url === "checkout") setHasReported(false);
    setProductos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, quantity: nuevaCantidad } : p))
    );
  };

  const handleSubmit = (index: number) => {
    if (index + 1 < productos.length) {
      inputsRef.current[index + 1]?.focus();
    } else {
      Keyboard.dismiss();
    }
  };

  const renderSyncStatus = () => {
    switch (syncStatus) {
      case "loading":
        return <ActivityIndicator size="small" color={themeColors.primary} />;
      case "success":
        return <MaterialIcons name="check" size={18} color={themeColors.success} />;
      case "error":
        return <MaterialIcons name="error" size={18} color={themeColors.danger} />;
      default:
        return null;
    }
  };

  const getContainerStyle = (item: any) => {
    const quantity = parseFloat(item.quantity || "0");
    const stock = parseFloat(item.stock ?? "");
    if (isNaN(stock) || quantity === 0) return [styles.productoContainer, { backgroundColor: themeColors.card, borderColor: themeColors.border }];
    if (quantity > stock) return [styles.productoContainer, { borderColor: themeColors.danger, backgroundColor: "#fdecea" }];
    return [styles.productoContainer, { borderColor: themeColors.success, backgroundColor: "#eafaf1" }];
  };

  const hayExcesoDeCantidad = productos.some((p) => {
    const qty = parseFloat(p.quantity || "0");
    const stk = parseFloat(p.stock ?? "0");
    return qty > stk;
  });

  const ejecutarAccion = async (accion: string) => {
    try {
      if (accion === "Guardar Inicial") {
        await postInicial();
        Alert.alert("Guardado", "Se guardaron las cantidades iniciales");
        setHasReported(true);
      } else if (accion === "Enviar Pedido") {
        await activateRequest();
        Alert.alert("Pedido enviado");
        setHasReported(true);
      } else if (accion === "Guardar Final") {
        await postFinal();
        Alert.alert("Final guardado");
        await AsyncStorage.multiRemove(["selectedLocal", "selectedResponsable"]);
        router.push("/");
      }
    } catch (e) {
      Alert.alert("Error", String(e));
    }
  };

  const handleAction = (accion: string) => {
    Alert.alert("Confirmar", `¿Desea ${accion}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Sí", onPress: () => ejecutarAccion(accion) },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: themeColors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: themeColors.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={60} // ajusta según tu header fijo
      >
        <View style={{ flex: 1 }}>
          {/* Header fijo */}
          <View style={[styles.headerRow, { backgroundColor: themeColors.card }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
              {hayExcesoDeCantidad && url === "checkout" && (
                <View style={styles.warningBanner}>
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                    ⚠️ Cantidad mayor al stock en algunos productos.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity onPress={() => setHelpVisible(true)} style={[styles.actionButton, { backgroundColor: themeColors.primary }]}>
                <Text style={styles.actionText}>Ayuda</Text>
              </TouchableOpacity>
              <View style={styles.syncIcon}>{renderSyncStatus()}</View>
              <TouchableOpacity onPress={load} style={[styles.actionButton, { backgroundColor: themeColors.primary }]}>
                <Text style={styles.actionText}>Actualizar</Text>
              </TouchableOpacity>
              {url === 'initial' && (
                <TouchableOpacity
                  onPress={() => !hasReported && handleAction("Guardar Inicial")}
                  style={[styles.actionButton, hasReported && styles.disabledButton, { backgroundColor: themeColors.primary }]}
                  disabled={hasReported}
                >
                  <Text style={[styles.actionText, hasReported && styles.disabledText]}>
                    {hasReported ? "Reportado" : "Guardar Inicial"}
                  </Text>
                </TouchableOpacity>
              )}

              {url === 'request' && (
                <TouchableOpacity onPress={() => !hasReported && handleAction("Enviar Pedido")} style={[styles.actionButton, hasReported && styles.disabledButton, { backgroundColor: themeColors.primary }]}
                  disabled={hasReported}>
                  <Text style={[styles.actionText, hasReported && styles.disabledText]}>{hasReported ? "En espera" : "Confirmar Pedido"}</Text>
                </TouchableOpacity>
              )}

              {url === 'checkout' && (
                <TouchableOpacity
                  onPress={() => (!hayExcesoDeCantidad && hasReported) && handleAction("Mover al área")}
                  style={[styles.actionButton, (hayExcesoDeCantidad || !hasReported) && styles.disabledButton, { backgroundColor: themeColors.primary }]}
                  disabled={hayExcesoDeCantidad || !hasReported}
                >
                  <Text style={[styles.actionText, (hayExcesoDeCantidad || !hasReported) && styles.disabledText]}>
                    {hayExcesoDeCantidad ? "Stock insuficiente" : !hasReported ? "Esperando aprovación" : "Mover al área"}
                  </Text>
                </TouchableOpacity>
              )}

              {url === 'final' && (
                <TouchableOpacity onPress={() => handleAction("Guardar Final")} style={[styles.actionButton, { backgroundColor: themeColors.primary }]}>
                  <Text style={styles.actionText}>Guardar Final</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Lista desplazable con los inputs */}
          <ScrollView
            contentContainerStyle={[{ backgroundColor: themeColors.background }]}
            keyboardShouldPersistTaps="handled"
          >
            {productos.map((item, index) => (
              <View key={item.id} style={getContainerStyle(item)}>
                <View style={styles.row}>
                  <View style={styles.infoLeft}>
                    <Text style={[styles.nombre, { color: themeColors.text }]}>
                      {item.name} ({standar[item.unitOfMeasureId]})
                    </Text>
                    {!!item.stock && (
                      <Text style={{ color: themeColors.text }}>
                        Stock: {item.stock}
                      </Text>
                    )}

                    {!!item.netContent && (
                      <Text style={{ color: themeColors.text }}>
                        Contenido neto: {item.netContent} {standar[item.netContentUnitOfMeasureId]}
                      </Text>
                    )}
                    {url === 'final' && (
                      <Text style={{ color: themeColors.text, fontWeight: "bold" }}>
                        Vendido: {item.sold}
                      </Text>
                    )}
                  </View>
                  <TextInput
                    ref={(ref) => {
                      if (ref) inputsRef.current[index] = ref;
                    }}
                    style={[
                      styles.input,
                      {
                        backgroundColor: themeColors.inputBg,
                        color: themeColors.inputText,
                        borderColor: themeColors.border,
                      },
                    ]}
                    keyboardType="decimal-pad"
                    editable={!((url === "initial" || url === "request") && hasReported)}
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
        </View>
      </KeyboardAvoidingView>

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  warningBanner: {
    backgroundColor: "#e67e22",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    elevation: 4,
    zIndex: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  buttonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionButton: {
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
  productoContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
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
    fontWeight: "600",
    marginBottom: 4,
  },
  input: {
    width: 80,
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    textAlign: "right",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  modalContainer: {
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  }, disabledButton: {
    backgroundColor: "#bdc3c7",
  },
  disabledText: {
    color: "#7f8c8d",
  },
});
