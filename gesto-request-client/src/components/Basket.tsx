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
// (2) Aceptar coma o punto
const cantidadRegex = /^\d*[.,]?\d{0,2}$/;
const COUNT_TIMES_KEY = "COUNT_TIMES";

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

function sumCounts(arr: (string | number)[]) {
  return arr.reduce((acc, val) => {
    const n = parseFloat(String(val).replace(",", "."));
    const a = typeof acc === "number" ? acc : parseFloat(String(acc).replace(",", "."));
    return (isNaN(a) ? 0 : a) + (isNaN(n) ? 0 : n);
  }, 0);
}

export default function Basket({ title, url, help }: BasketProps) {
  const [productos, setProductos] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [hasReported, setHasReported] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [confirmState, setConfirmState] = useState<{ visible: boolean; accion?: string }>({
    visible: false,
  });

  const [query, setQuery] = useState("");
  const [countTimes, setCountTimes] = useState<number>(1);

  const inputsRef = useRef<any[]>([]);
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
    accent: isDark ? "#F59E0B" : "#d35400",
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const run = async () => {
        const ctRaw = await AsyncStorage.getItem(COUNT_TIMES_KEY);
        let ct = parseInt(ctRaw || "1", 10);
        if (isNaN(ct) || ct < 1) ct = 1;
        if (!isActive) return;
        setCountTimes(ct);
        await load(ct);
      };
      run();
      return () => {
        isActive = false;
      };
    }, [url])
  );

  const ensureCountsShape = useCallback((arr: any[], ct: number) => {
    return arr.map((p) => {
      let counts: string[] = Array.isArray(p.counts) ? [...p.counts] : [];
      if (counts.length === 0) {
        const initial = p.quantity != null && p.quantity !== "" ? String(p.quantity) : "";
        counts = new Array(ct).fill("");
        counts[0] = initial;
      } else {
        if (counts.length < ct) counts = counts.concat(new Array(ct - counts.length).fill(""));
        if (counts.length > ct) counts = counts.slice(0, ct);
      }
      const total = sumCounts(counts);
      return { ...p, counts, quantity: total ? String(total) : counts[0] || "" };
    });
  }, []);

  const load = async (ctForShape?: number) => {
    try {
      const areaId = await AsyncStorage.getItem("selectedLocal");
      const userId = await AsyncStorage.getItem("selectedResponsable");
      if (!areaId || !userId) return router.push({ pathname: "/" });

      const saved = await getProductsSaved(url);
      const shaped = ensureCountsShape(saved, ctForShape ?? countTimes);
      setProductos(shaped);
      setHasReported(saved.some((p: any) => !!p.reported));
    } catch (e) {
      Alert.alert("Error cargando los productos", String(e));
    }
  };

  useEffect(() => {
    if (!productos.length) return;
    setProductos((prev) => ensureCountsShape(prev, countTimes));
  }, [countTimes, ensureCountsShape, productos.length]);

  useEffect(() => {
    if (!productos?.length) return;
    const timer = setTimeout(async () => {
      try {
        setSyncStatus("loading");
        await syncProducts(url, productos);
        setSyncStatus("success");
      } catch {
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

  const actualizarCantidadParcial = (id: string, countIndex: number, nuevaCantidad: string) => {
    if (!cantidadRegex.test(nuevaCantidad)) return;
    setProductos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const counts: string[] = Array.isArray(p.counts)
          ? [...p.counts]
          : new Array(countTimes).fill("");
        counts[countIndex] = nuevaCantidad;
        const total = sumCounts(counts);
        return { ...p, counts, quantity: total ? String(total) : "" };
      })
    );
  };

  const handleSubmit = (prodIndex: number, dataLength: number) => {
    if (prodIndex + 1 < dataLength) {
      const nextRef = inputsRef.current[(prodIndex + 1) * Math.max(1, countTimes)];
      if (nextRef?.focus) nextRef.focus();
    } else {
      Keyboard.dismiss();
    }
  };

  const handleSubmitMulti = (prodIndex: number, countIndex: number, dataLength: number) => {
    const flatIndex = prodIndex * countTimes + countIndex + 1;
    const nextRef =
      inputsRef.current[flatIndex] ?? inputsRef.current[(prodIndex + 1) * countTimes];
    if (nextRef?.focus) nextRef.focus();
    else Keyboard.dismiss();
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
    if (item.price===null && url!="request")
      return [styles.productoContainer, { borderColor: themeColors.danger, backgroundColor: themeColors.background }];
    return [styles.productoContainer,  { backgroundColor: themeColors.card, borderColor: themeColors.border }];
  };

  const hayExcesoDeCantidad = productos.some((p) => {
    const qty = parseFloat(p.quantity || "0");
    const stk = parseFloat(p.stock ?? "0");
    return p.price===null;
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
      } else if (accion === "Mover al área") {
        Alert.alert("Éxito", "Se movió al área");
      }
    } catch (e) {
      Alert.alert("Error", String(e));
    }
  };

  const handleAction = (accion: string) => {
    setConfirmState({ visible: true, accion });
  };

  const filteredProductos = useMemo(() => {
    const q = normalize(query);
    if (!q) return productos;
    return productos.filter((p) => normalize(p.name).includes(q));
  }, [productos, query]);

   const income = useMemo(() => {
    return productos.reduce((acc,item) => acc+item.monto,0);
  }, [productos]);

  const onSearchFocus = useCallback(() => {
    if (!query) return;
    setQuery("");
  }, [query]);

  // ====== BLOQUES UI ======
  const TotalInline = ({ value }: { value: string }) => (
    <Text style={[styles.totalTextInline, { color: themeColors.accent }]}>
      Total: {value || "0"}
    </Text>
  );

  const TotalBadgeRight = ({ value }: { value: string }) => (
    <View style={[styles.totalBadge, { borderColor: themeColors.accent }]}>
      <Text style={[styles.totalBadgeText, { color: themeColors.accent }]} numberOfLines={1}>
        Total: {value || "0"}
      </Text>
    </View>
  );

  const CountsRight = (item: any, prodIndex: number) => {
    const editable = !((url === "initial" || url === "request") && hasReported);
    const counts: string[] = Array.isArray(item.counts)
      ? (item.counts.length === countTimes
          ? item.counts
          : [...item.counts, ...new Array(Math.max(0, countTimes - item.counts.length)).fill("")]
        ).slice(0, countTimes)
      : new Array(countTimes).fill("");

    const inputWidth = countTimes === 2 ? "48%" : "100%";

    return (
      <View style={styles.rightForty}>
        <View style={styles.countsRightInner}>
          {counts.map((val, cIdx) => {
            const flatKey = prodIndex * countTimes + cIdx;
            return (
              <TextInput
                key={`c-${item.id}-${cIdx}`}
                ref={(ref) => {
                  if (ref) inputsRef.current[flatKey] = ref;
                }}
                style={[
                  styles.countInputBase,
                  { width: inputWidth },
                  {
                    backgroundColor: themeColors.inputBg,
                    color: themeColors.inputText,
                    borderColor: themeColors.border,
                  },
                ]}
                keyboardType="decimal-pad"
                inputMode="decimal"           // (4) hint web
                editable={editable}
                value={val ?? ""}
                onChangeText={(text) => actualizarCantidadParcial(item.id, cIdx, text)}
                onSubmitEditing={() => handleSubmitMulti(prodIndex, cIdx, filteredProductos.length)}
                placeholder="0"
                placeholderTextColor="#888"
                returnKeyType="next"
              />
            );
          })}
        </View>
      </View>
    );
  };

  const CountsStack = (item: any, prodIndex: number) => {
    const editable = !((url === "initial" || url === "request") && hasReported);
    const counts: string[] = Array.isArray(item.counts)
      ? (item.counts.length === countTimes
          ? item.counts
          : [...item.counts, ...new Array(Math.max(0, countTimes - item.counts.length)).fill("")]
        ).slice(0, countTimes)
      : new Array(countTimes).fill("");

    return (
      <View style={styles.countsRowStack}>
        {counts.map((val, cIdx) => {
          const flatKey = prodIndex * countTimes + cIdx;
          return (
            <TextInput
              key={`cs-${item.id}-${cIdx}`}
              ref={(ref) => {
                if (ref) inputsRef.current[flatKey] = ref;
              }}
              style={[
                styles.countInputBase,
                styles.countInputStack,
                {
                  backgroundColor: themeColors.inputBg,
                  color: themeColors.inputText,
                  borderColor: themeColors.border,
                },
              ]}
              keyboardType="decimal-pad"
              inputMode="decimal"           // (4) hint web
              editable={editable}
              value={val ?? ""}
              onChangeText={(text) => actualizarCantidadParcial(item.id, cIdx, text)}
              onSubmitEditing={() => handleSubmitMulti(prodIndex, cIdx, filteredProductos.length)}
              placeholder="0"
              placeholderTextColor="#888"
              returnKeyType="next"
            />
          );
        })}
      </View>
    );
  };

  const ProductInfoBlock = ({ item, style, children }: { item: any; style?: any; children?: React.ReactNode }) => (
    <View style={[styles.infoLeft, style]}>
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
      {children}
    </View>
  );

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const isMulti = url === "initial" || url === "final";
      const stacked = isMulti && countTimes >= 3;
      const showTotal = isMulti && countTimes > 1;

      if (!isMulti) {
        return (
          <View style={getContainerStyle(item)}>
            <View style={styles.row}>
              <ProductInfoBlock item={item} />
              <TextInput
                ref={(ref) => {
                  if (ref) inputsRef.current[index] = ref;
                }}
                style={[
                  styles.inputFlex,
                  {
                    backgroundColor: themeColors.inputBg,
                    color: themeColors.inputText,
                    borderColor: themeColors.border,
                  },
                ]}
                keyboardType="decimal-pad"
                inputMode="decimal"         // (4) hint web
                editable={!((url === "initial" || url === "request") && hasReported)}
                value={item.quantity?.toString() || ""}
                onChangeText={(text) => actualizarCantidad(item.id, text)}
                onSubmitEditing={() => handleSubmit(index, filteredProductos.length)}
                placeholder="Cantidad"
                 blurOnSubmit={false}
                placeholderTextColor="#888"
                returnKeyType="next"
              />
            </View>
          </View>
        );
      }

      if (!stacked) {
        return (
          <View style={getContainerStyle(item)}>
            <View style={styles.rowTopAligned}>
              <ProductInfoBlock item={item} style={styles.infoSixty}>
                {showTotal && <TotalInline value={item.quantity} />}
              </ProductInfoBlock>
              {CountsRight(item, index)}
            </View>
          </View>
        );
      }

      return (
        <View style={getContainerStyle(item)}>
          <View style={styles.headerStackRow}>
            <View style={styles.headerStackLeft}>
              <ProductInfoBlock item={item} />
            </View>
            <View style={styles.headerStackRight}>
              {showTotal && <TotalBadgeRight value={item.quantity} />}
            </View>
          </View>
          {CountsStack(item, index)}
        </View>
      );
    },
    [countTimes, filteredProductos.length, hasReported, themeColors, url]
  );

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
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
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
    <>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: themeColors.background }}
             behavior={Platform.OS === "ios" ? "padding" : "height"}
    keyboardVerticalOffset={60}
      >
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: themeColors.card }]}>
            <View style={styles.headerTopRow}>
              <Text style={[styles.titleSmall, { color: themeColors.text }]} numberOfLines={1} ellipsizeMode="tail">
                {title}
              </Text>
              <View style={styles.topRight}>
                <View style={styles.syncIcon}>{renderSyncStatus()}</View>
                
                <TouchableOpacity onPress={() => setHelpVisible(true)} style={[styles.actionButton, { backgroundColor: themeColors.primary }]}>
                  <Text style={styles.actionText}>Ayuda</Text>
                </TouchableOpacity>
              </View>
            </View>

            {hayExcesoDeCantidad && url !== "request" && (
              <View style={styles.warningBanner}>
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>⚠️ Los productos con el borde rojo no tienen precio asignado, el importe debe calcularse manualmente para estos. (Marcados en rojo)</Text>
              </View>
            )}
            

            <View style={styles.headerBottomRow}>
              <View style={[styles.searchBox, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                <MaterialIcons name="search" size={18} color="#888" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  onFocus={onSearchFocus}
                  placeholder="Buscar..."
                  placeholderTextColor="#888"
                   blurOnSubmit={false}
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

              <View style={styles.bottomRight}>
                <TouchableOpacity onPress={() => load(countTimes)} style={[styles.actionButton, { backgroundColor: themeColors.primary }]}>
                  <Text style={styles.actionText}>Actualizar</Text>
                </TouchableOpacity>

                {url === "initial" && (
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

                {url === "request" && (
                  <TouchableOpacity
                    onPress={() => !hasReported && handleAction("Enviar Pedido")}
                    style={[styles.actionButton, hasReported && styles.disabledButton, { backgroundColor: themeColors.primary }]}
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
                    style={[styles.actionButton, (hayExcesoDeCantidad || !hasReported) && styles.disabledButton, { backgroundColor: themeColors.primary }]}
                    disabled={hayExcesoDeCantidad || !hasReported}
                  >
                    <Text style={[styles.actionText, (hayExcesoDeCantidad || !hasReported) && styles.disabledText]}>
                      {hayExcesoDeCantidad ? "Stock insuficiente" : !hasReported ? "Esperando aprovación" : "Mover al área"}
                    </Text>
                  </TouchableOpacity>
                )}

                {url === "final" && (
                  <TouchableOpacity onPress={() => handleAction("Guardar Final")} style={[styles.actionButton, { backgroundColor: themeColors.primary }]}>
                    <Text style={styles.actionText}>Guardar Final</Text>
                  </TouchableOpacity>
                )}
                
              </View>
            </View>{url == "final" && (
              <View>
              <Text style={[styles.importText,{color:themeColors.text}]}>Importe: ${income}</Text>
              </View>
            )}
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
            keyboardShouldPersistTaps="always"
  keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
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
            <TouchableOpacity onPress={() => setHelpVisible(false)} style={[styles.actionButton, { backgroundColor: themeColors.danger, marginTop: 10 }]}>
              <Text style={styles.actionText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirmación */}
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
    </>
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
    flex: 1,
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

  productoContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    overflow: "hidden",
  },

  // Filas de producto
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  rowTopAligned: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },

  // Info producto
  infoLeft: {
    flex: 1,
    flexShrink: 1,          // (1) quitar marginRight, usar flex puro
  },
  // (1) 60% / 40% con flex ratios
  infoSixty: {
    flex: 3,                // ≈ 60%
  },

  nombre: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    flexWrap: "wrap",
  },

  // Total inline (izquierda)
  totalTextInline: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "800",
  },

  // Input único (no-multi) - (3) mínimo 20% del contenedor
  inputFlex: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    textAlign: "right",
    flexBasis: "20%",
    minWidth: 80,
    flexShrink: 1,
  },

  // Mitad derecha para conteos (countTimes < 3) - (1) usar flex ratio
  rightForty: {
    flex: 2,                // ≈ 40%
  },
  countsRightInner: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  // Conteos (debajo cuando countTimes >= 3)
  countsRowStack: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  // Base de cada input de conteo
  countInputBase: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    textAlign: "right",
    marginBottom: 8,
  },
  // En Stack (≥3): 3 por fila
  countInputStack: {
    width: "30%",
    minWidth: 80,
  },

  // Cabecera para stacked (info izquierda + total derecha)
  headerStackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerStackLeft: {
    flex: 1,
    paddingRight: 10,
  },
  headerStackRight: {
    width: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  totalBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
  },
  totalBadgeText: {
    fontSize: 16,
    fontWeight: "800",
  },

  // Overlays / Modales
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
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
   importText: {
    fontWeight: "900",
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
});
