import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ImageSourcePropType,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
  Pressable,
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

const standar: Record<string, string> = { mass: "g", units: "u", volume: "mL", distance: "cm" };
const cantidadRegex = /^\d*\.?\d{0,2}$/;

interface BasketProps {
  title: string;
  url: "initial" | "request" | "checkout" | "final" | string;
  help: {
    title: string;
    image: ImageSourcePropType;
    content: { subtitle: string; content: string }[];
  };
}

function normalize(str: string) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function Basket({ title, url, help }: BasketProps) {
  const [productos, setProductos] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [hasReported, setHasReported] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);

  // Confirmación cross-platform (incluye Web)
  const [confirmState, setConfirmState] = useState<{ visible: boolean; accion?: string }>({
    visible: false,
  });

  const inputsRef = useRef<any[]>([]);

  // search
  const [query, setQuery] = useState("");

  // list + scroll refs
  const listRef = useRef<FlatList<any>>(null);
  const scrollOffsetRef = useRef(0);

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
      if (!areaId || !userId) {
        console.log("Area o usuario faltante ",areaId,userId);
        return router.push({ pathname: "/" });
      }

      const saved = await getProductsSaved(url);
      setProductos([...saved]);
      setHasReported(saved.some((p) => !!p.reported));
    } catch (e) {
      Alert.alert("Error cargando los productos", String(e));
    }
  };

  // sync when productos change
  useEffect(() => {
    if (!productos?.length) return;
    const timer = setTimeout(async () => {
      try {
        setSyncStatus("loading");
        await syncProducts(url, productos);
        setSyncStatus("success");
      } catch (error) {
        setSyncStatus("error");
      } finally {
        setTimeout(() => setSyncStatus("idle"), 500);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [productos, url]);

  const actualizarCantidad = (id: string, nuevaCantidad: string) => {
    if (!cantidadRegex.test(nuevaCantidad)) return;
    if (url === "checkout") setHasReported(false);
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, quantity: nuevaCantidad } : p)));
  };

  const handleSubmit = (index: number, dataLength: number) => {
    if (index + 1 < dataLength) {
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
    if (isNaN(stock) || quantity === 0)
      return [
        styles.productoContainer,
        { backgroundColor: themeColors.card, borderColor: themeColors.border },
      ];
    if (quantity > stock)
      return [styles.productoContainer, { borderColor: themeColors.danger, backgroundColor: "#fdecea" }];
    return [styles.productoContainer, { borderColor: themeColors.success, backgroundColor: "#eafaf1" }];
  };

  const hayExcesoDeCantidad = productos.some((p) => {
    const qty = parseFloat(p.quantity || "0");
    const stk = parseFloat(p.stock ?? "0");
    return qty > stk;
  });

  // Acciones reales
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
      } else if (accion === "Mover al área") {
        // Si luego agregas endpoint específico, ponlo aquí
        Alert.alert("Éxito", "Se movió al área");
      }
    } catch (e) {
      Alert.alert("Error", String(e));
    }
  };

  // Abre modal de confirmación (funciona en Web)
  const handleAction = (accion: string) => {
    setConfirmState({ visible: true, accion });
  };

  const filteredProductos = useMemo(() => {
    const q = normalize(query);
    if (!q) return productos;
    return productos.filter((p) => normalize(p.name).includes(q));
  }, [productos, query]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
  };

  const onInputFocus = useCallback(() => {
    if (!query) return;
    const offset = scrollOffsetRef.current;
    setQuery("");
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset, animated: false });
    });
  }, [query]);

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => (
      <View style={getContainerStyle(item)}>
        <View style={styles.row}>
          <View style={styles.infoLeft}>
            <Text style={[styles.nombre, { color: themeColors.text }]}>
              {item.name} ({standar[item.unitOfMeasureId]})
            </Text>
            {!!item.stock && <Text style={{ color: themeColors.text }}>Stock: {item.stock}</Text>}
            {!!item.netContent && (
              <Text style={{ color: themeColors.text }}>
                Contenido neto: {item.netContent} {standar[item.netContentUnitOfMeasureId]}
              </Text>
            )}
            {url === "final" && (
              <Text style={{ color: themeColors.text, fontWeight: "bold" }}>Consumido: {item.sold}</Text>
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
            onFocus={onInputFocus}
            onChangeText={(text) => actualizarCantidad(item.id, text)}
            onSubmitEditing={() => handleSubmit(index, filteredProductos.length)}
            placeholder="Cantidad"
            placeholderTextColor="#888"
            returnKeyType="next"
          />
        </View>
      </View>
    ),
    [filteredProductos.length, hasReported, themeColors, url, onInputFocus]
  );

  // Componente de Confirmación (Modal compatible con Web)
  const ConfirmDialog = ({
    visible,
    text,
    onCancel,
    onConfirm,
  }: {
    visible: boolean;
    text: string;
    onCancel: () => void;
    onConfirm: () => void;
  }) => {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.confirmText, { color: themeColors.text }]}>{text}</Text>
            <View style={styles.confirmActions}>
              <Pressable onPress={onCancel} style={[styles.actionButton, { backgroundColor: themeColors.disabled }]}>
                <Text style={styles.actionText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={onConfirm} style={[styles.actionButton, { backgroundColor: themeColors.primary }]}>
                <Text style={styles.actionText}>Sí</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: themeColors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: themeColors.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={60}
      >
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: themeColors.card }]}>
            {/* Fila superior */}
            <View style={styles.headerTopRow}>
              <Text
                style={[styles.titleSmall, { color: themeColors.text }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {title}
              </Text>

              <View style={styles.topRight}>
                <View style={styles.syncIcon}>{renderSyncStatus()}</View>
                <TouchableOpacity
                  onPress={() => setHelpVisible(true)}
                  style={[styles.actionButton, { backgroundColor: themeColors.primary }]}
                >
                  <Text style={styles.actionText}>Ayuda</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Warning (si aplica) */}
            {hayExcesoDeCantidad && url === "checkout" && (
              <View style={styles.warningBanner}>
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                  ⚠️ Cantidad mayor al stock en algunos productos.
                </Text>
              </View>
            )}

            {/* Fila inferior: buscador + botones */}
            <View style={styles.headerBottomRow}>
              {/* Buscador */}
              <View
                style={[
                  styles.searchBox,
                  { backgroundColor: themeColors.inputBg, borderColor: themeColors.border },
                ]}
              >
                <MaterialIcons name="search" size={18} color="#888" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar producto..."
                  placeholderTextColor="#888"
                  style={[styles.searchInput, { color: themeColors.inputText }]}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {!!query && (
                  <TouchableOpacity onPress={() => setQuery("")}>
                    <MaterialIcons name="close" size={18} color="#888" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Botones derecha */}
              <View style={styles.bottomRight}>
                <TouchableOpacity
                  onPress={load}
                  style={[styles.actionButton, { backgroundColor: themeColors.primary }]}
                >
                  <Text style={styles.actionText}>Actualizar</Text>
                </TouchableOpacity>

                {url === "initial" && (
                  <TouchableOpacity
                    onPress={() => !hasReported && handleAction("Guardar Inicial")}
                    style={[
                      styles.actionButton,
                      hasReported && styles.disabledButton,
                      { backgroundColor: themeColors.primary },
                    ]}
                    disabled={hasReported}
                  >
                    <Text style={[styles.actionText, hasReported && styles.disabledText]}>
                      {hasReported ? "Reportado" : "Guardar Inicial"}
                    </Text>
                  </TouchableOpacity>
                )}

                {url === "request" && (
                  <TouchableOpacity
                    onPress={() => !hasReported && handleAction("Enviar Pedido")}
                    style={[
                      styles.actionButton,
                      hasReported && styles.disabledButton,
                      { backgroundColor: themeColors.primary },
                    ]}
                    disabled={hasReported}
                  >
                    <Text style={[styles.actionText, hasReported && styles.disabledText]}>
                      {hasReported ? "En espera" : "Confirmar Pedido"}
                    </Text>
                  </TouchableOpacity>
                )}

                {url === "checkout" && (
                  <TouchableOpacity
                    onPress={() => !hayExcesoDeCantidad && hasReported && handleAction("Mover al área")}
                    style={[
                      styles.actionButton,
                      (hayExcesoDeCantidad || !hasReported) && styles.disabledButton,
                      { backgroundColor: themeColors.primary },
                    ]}
                    disabled={hayExcesoDeCantidad || !hasReported}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        (hayExcesoDeCantidad || !hasReported) && styles.disabledText,
                      ]}
                    >
                      {hayExcesoDeCantidad
                        ? "Stock insuficiente"
                        : !hasReported
                        ? "Esperando aprovación"
                        : "Mover al área"}
                    </Text>
                  </TouchableOpacity>
                )}

                {url === "final" && (
                  <TouchableOpacity
                    onPress={() => handleAction("Guardar Final")}
                    style={[styles.actionButton, { backgroundColor: themeColors.primary }]}
                  >
                    <Text style={styles.actionText}>Guardar Final</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Lista virtualizada */}
          <FlatList
            ref={listRef}
            data={filteredProductos}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={{
              backgroundColor: themeColors.background,
              paddingHorizontal: 10,
              paddingTop: 10,
              paddingBottom: 10,
            }}
            keyboardShouldPersistTaps="handled"
            onScroll={onScroll}
            scrollEventThrottle={16}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={10}
            removeClippedSubviews
          />
        </View>
      </KeyboardAvoidingView>

      {/* Modal de ayuda */}
      <Modal visible={helpVisible} animationType="slide" transparent onRequestClose={() => setHelpVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>{help.title}</Text>
            <FlatList
              data={help.content}
              keyExtractor={(_, i) => `help-${i}`}
              style={{ maxHeight: "80%" }}
              renderItem={({ item }) => (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontWeight: "600", color: themeColors.text }}>{item.subtitle}</Text>
                  <Text style={{ color: themeColors.text }}>{item.content}</Text>
                </View>
              )}
            />
            <TouchableOpacity
              onPress={() => setHelpVisible(false)}
              style={[styles.actionButton, { backgroundColor: themeColors.danger, marginTop: 10 }]}
            >
              <Text style={styles.actionText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de confirmación cross-platform (incluye Web) */}
      <ConfirmDialog
        visible={confirmState.visible}
        text={`¿Desea ${confirmState.accion}?`}
        onCancel={() => setConfirmState({ visible: false })}
        onConfirm={() => {
          const a = confirmState.accion!;
          setConfirmState({ visible: false });
          ejecutarAccion(a);
        }}
      />
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

  header: {
    padding: 10,
    elevation: 4,
    zIndex: 10,
    gap: 8,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  titleSmall: {
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
  },
  headerBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchBox: {
    flex: 1, // ocupa el espacio restante
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },

  bottomRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
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

  // Overlay genérico
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  // Ayuda
  modalContainer: {
    borderRadius: 12,
    padding: 16,
    width: 520,
    maxWidth: "100%",
    maxHeight: "90%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },

  // Confirmación
  confirmCard: {
    borderRadius: 12,
    padding: 16,
    width: 360,
    maxWidth: "90%",
    alignSelf: "center",
  },
  confirmText: {
    fontSize: 16,
    marginBottom: 12,
  },
  confirmActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },

  disabledButton: {
    backgroundColor: "#bdc3c7",
  },
  disabledText: {
    color: "#7f8c8d",
  },
});
