import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import { useAppTheme } from "@/providers/ThemeProvider";

import {
  getPendingTransfer,
  receiveTransfer,
} from "@/services/pedidos.service";

const standar: Record<string, string> = {
  mass: "g",
  units: "u",
  volume: "mL",
  distance: "cm",
};

export default function PendingTransferView() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [receiving, setReceiving] = useState<boolean>(false); // ⬅ LOADER PARA RECIBIR

  const { theme } = useAppTheme();
  const isDark = theme === "dark";

  const themeColors = {
    background: isDark ? "#111827" : "#f2f2f2",
    card: isDark ? "#1f2937" : "#ffffff",
    text: isDark ? "#f9fafb" : "#2c3e50",
    border: isDark ? "#374151" : "#e0e0e0",
    primary: isDark ? "#60A5FA" : "#3498db",
    success: "#2ecc71",
    danger: "#e74c3c",
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getPendingTransfer();
      setItems(data || []);
    } catch (e) {
      Alert.alert("Error", "No se pudo obtener la transferencia pendiente.");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleReceive = () => {
    Alert.alert(
      "Confirmar",
      "¿Deseas marcar como recibida esta transferencia?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Recibir",
          style: "destructive",
          onPress: async () => {
            setReceiving(true); // ⬅ Mostrar loader

            try {
              const result = await receiveTransfer(); // true / false

              setReceiving(false);

              if (result === true) {
                Alert.alert(
                  "Movimiento completado",
                  "La transferencia fue recibida satisfactoriamente.",
                  [
                    {
                      text: "Aceptar",
                      onPress: () => router.push("/history"), // ⬅ Navega a movimientos recientes
                    },
                  ]
                );
              } else {
                Alert.alert(
                  "Error",
                  "Hubo un error procesando la transferencia."
                );
              }
            } catch (e) {
              setReceiving(false);
              Alert.alert("Error", "No se pudo completar la acción.");
            }
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const renderItem = ({ item }: any) => (
    <View
      style={[
        styles.productoContainer,
        {
          borderColor: themeColors.border,
          backgroundColor: themeColors.card,
        },
      ]}
    >
      <View style={styles.rowTopAligned}>
        <View style={styles.infoLeft}>
          <Text style={[styles.nombre, { color: themeColors.text }]}>
            {item.name} ({standar[item.unitOfMeasureId]})
          </Text>

          {item.netContent && (
            <Text style={{ color: themeColors.text }}>
              Contenido neto: {item.netContent}{" "}
              {standar[item.netContentUnitOfMeasureId]}
            </Text>
          )}

          {item.stock != null && (
            <Text style={{ color: themeColors.text }}>
              Stock actual: {item.stock}
            </Text>
          )}
        </View>

        {/* BADGE */}
        <View
          style={[
            styles.badgeContainer,
            { borderColor: themeColors.primary },
          ]}
        >
          <Text style={[styles.badgeText, { color: themeColors.primary }]}>
            {item.quantity} {standar[item.unitOfMeasureId]}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <Text style={[styles.titleSmall, { color: themeColors.text }]}>
          Productos a recibir
        </Text>

        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={onRefresh}
            style={[styles.actionButton, { backgroundColor: themeColors.primary }]}
          >
            <Text style={styles.actionText}>Actualizar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleReceive}
            style={[styles.actionButton, { backgroundColor: themeColors.success }]}
          >
            <Text style={styles.actionText}>Recibir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* LISTA */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          onRefresh={onRefresh}
          refreshing={refreshing}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12 }}
        />
      )}

      {/* ============================= */}
      {/*      LOADER A PANTALLA COMPLETA */}
      {/* ============================= */}
      <Modal visible={receiving} transparent animationType="fade">
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={{ marginTop: 12, color: "#fff", fontSize: 16 }}>
            Procesando...
          </Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 12,
    elevation: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 8,
  },
  titleSmall: {
    fontSize: 16,
    fontWeight: "700",
  },
  productoContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  rowTopAligned: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  infoLeft: { flex: 1 },
  nombre: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  badgeContainer: {
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 16,
    fontWeight: "800",
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  actionText: {
    color: "#fff",
    fontWeight: "700",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  /** LOADER FULLSCREEN */
  loaderOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
});
