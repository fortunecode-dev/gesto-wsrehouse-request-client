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
  Modal,
  Pressable,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useAppTheme } from "@/providers/ThemeProvider";

import {
  activateRequest,
  getAreas,
  getProductsSaved,
  postArea2Area,
  postFinal,
  postInicial,
  syncProducts,
} from "@/services/pedidos.service";
import ModalSeleccionLocal from "./LocalResponsableModal";
import { API_URL } from "@/config";

/* ============================
   Constantes y tipos
   ============================ */

/** Mapeo para unidades */
const standar: Record<string, string> = { mass: "g", units: "u", volume: "mL", distance: "cm" };

/** Regex que valida cantidades con hasta 2 decimales (coma o punto) */
const cantidadRegex = /^\d*[.,]?\d{0,2}$/;

/** Claves de AsyncStorage usadas por el componente */
const COUNT_TIMES_KEY = "COUNT_TIMES";
const POS_MODE_KEY = "POS_MODE";
const CASA_DATA_KEY = "CASA_DATA";
const DEUDA_DATA_KEY = "DEUDA_DATA";

/** Props del componente */
interface BasketProps {
  title: string;
  url: "initial" | "request" | "checkout" | "final" | "casa" | string;
  help: {
    title: string;
    image: ImageSourcePropType;
    content: { subtitle: string; content: string }[];
  };
}

/* ============================
   Utilidades puras
   ============================ */

/**
 * Normaliza texto para búsquedas (quita tildes, pasa a minúsculas y trim).
 * @param str texto a normalizar
 */
function normalize(str: string) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Suma un array de valores que pueden ser string/number (acepta coma decimal).
 * Retorna number.
 * @param arr array de strings o números
 */
function sumCounts(arr: (string | number)[]) {
  return arr.reduce((acc, val) => {
    const n = parseFloat(String(val).replace(",", "."));
    const a = typeof acc === "number" ? acc : parseFloat(String(acc).replace(",", "."));
    return (isNaN(a) ? 0 : a) + (isNaN(n) ? 0 : n);
  }, 0);
}

/* ============================
   Componente principal
   ============================ */

export default function Basket({ title, url, help }: BasketProps) {
  /* ----------------------------
     Estado local
     ---------------------------- */
  const [productos, setProductos] = useState<any[]>([]);
  const [areaName, setAreaName] = useState<string>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [hasReported, setHasReported] = useState(false);
  const [casaMap, setCasaMap] = useState<Record<string, string>>({});
  const [deudaMap, setDeudaMap] = useState<Record<string, string>>({});
  const [helpVisible, setHelpVisible] = useState(false);
  const [trying, setTrying] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean>(true);
  const [alertedOffline, setAlertedOffline] = useState(false);
  const [confirmState, setConfirmState] = useState<{ visible: boolean; accion?: string; text?: string }>({
    visible: false,
    accion: undefined,
    text: undefined,
  });
  const [selectedLocal, setSelectedLocal] = useState<string>('');
  const [responsable, setSelectedResponsable] = useState<string>('');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [query, setQuery] = useState("");
  const [countTimes, setCountTimes] = useState<number>(1);
  const [posModeEnabled, setPosModeEnabled] = useState<boolean>(false);
  // Validaciones/flags usados en la UI
  const [isDesgloseValid, setIsDesgloseValid] = useState<boolean>(false);
  const [isCasaValid, setIsCasaValid] = useState<boolean>(false);
  const [isDeudaValid, setIsDeudaValid] = useState<boolean>(false);

  // Loader interno para la lista
  const [loadingItems, setLoadingItems] = useState<boolean>(false);

  // Refs para manejo de focus en los inputs
  const inputsRef = useRef<any[]>([]);
  const listRef = useRef<FlatList<any>>(null);
  const productosRef = useRef(productos);
  const clear = async () => {
    await AsyncStorage.removeItem('DESGLOSE_DATA')
    await AsyncStorage.removeItem('CASA_DATA')
    await AsyncStorage.removeItem('DEUDA_DATA')
  }

  // 🔄 Health check cada 5 segundos
  useEffect(() => {
    let mounted = true;
    let healthURL = "";

    const offlineRef = { current: false };
    const syncingRef = { current: false };

    // --- Mantener productos actualizados en el ref ---
    productosRef.current = productos;

    (async () => {
      healthURL = `${await API_URL()}/health`;
    })();

    const interval = setInterval(async () => {
      if (!mounted || !healthURL) return;

      // 🔵 Cada ciclo empieza reintentando
      if (offlineRef.current) setTrying(true);

      try {
        const res = await fetch(healthURL);
        const ok = res.ok;

        // --- RESTABLECIDA ---
        if (ok) {
          if (offlineRef.current) {
            offlineRef.current = false;
            setAlertedOffline(false);
            setServerOnline(true);

            // Auto-sync con productos actuales
            if (!syncingRef.current) {
              syncingRef.current = true;
              try {
                await syncProducts(url, productosRef.current);
                const [desgOk, casaOk, deudaOk] = await Promise.all([validateDesglose(), validateCasa(), validateDeuda()]);
                setIsDesgloseValid(Boolean(desgOk));
                setIsCasaValid(Boolean(casaOk));
                setIsDeudaValid(Boolean(deudaOk));
                setSyncStatus("success");
              } catch {
                setSyncStatus("error");
              } finally {
                syncingRef.current = false;
              }
            }
          }

          setTrying(false);
          return;
        }

        // --- SIN CONEXIÓN ---
        if (!offlineRef.current) {
          offlineRef.current = true;
          setAlertedOffline(true);
          setServerOnline(false);
          Alert.alert("Conexión perdida", "No hay conexión con el servidor.");
        }
      } catch {
        if (!offlineRef.current) {
          offlineRef.current = true;
          setAlertedOffline(true);
          setServerOnline(false);
          Alert.alert("Conexión perdida", "No hay conexión con el servidor.");
        }
      }

      // 🔴 FIN DEL INTENTO
      setTrying(false);

    }, 5000);


    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []); // <-- SIN dependencias

  /* ----------------------------
     Theme (colores dinámicos)
     ---------------------------- */
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

  /* ============================
     Helpers y validaciones async
     ============================ */


  /**
   * validateCasa
   * Comprueba si CASA_DATA existe y fue guardado el mismo día (meta.savedAt).
   */
  const validateCasa = async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(CASA_DATA_KEY);
      if (!raw) return false;

      const parsed = JSON.parse(raw);
      const savedAtRaw = parsed?.meta?.savedAt ?? parsed?.savedAt;
      if (!savedAtRaw) return false;

      const savedDate = new Date(savedAtRaw);
      if (Number.isNaN(savedDate.getTime())) return false;

      const now = new Date();

      // Comparar solo año/mes/día (misma jornada)
      const sameDay =
        savedDate.getFullYear() === now.getFullYear() &&
        savedDate.getMonth() === now.getMonth() &&
        savedDate.getDate() === now.getDate();

      return sameDay;
    } catch {
      return false;
    }
  };
  const validateDeuda = async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(DEUDA_DATA_KEY);
      if (!raw) return false;

      const parsed = JSON.parse(raw);
      const savedAtRaw = parsed?.meta?.savedAt ?? parsed?.savedAt;
      if (!savedAtRaw) return false;

      const savedDate = new Date(savedAtRaw);
      if (Number.isNaN(savedDate.getTime())) return false;

      const now = new Date();

      // Comparar solo año/mes/día (misma jornada)
      const sameDay =
        savedDate.getFullYear() === now.getFullYear() &&
        savedDate.getMonth() === now.getMonth() &&
        savedDate.getDate() === now.getDate();

      return sameDay;
    } catch {
      return false;
    }
  };
  /* ============================
     Efectos de carga y sincronización
     ============================ */


  /**
   * Cuando cambian los productos -> debounce de sincronización con backend (syncProducts)
   * Evita sincronizar para la ruta 'casa' (evita escrituras innecesarias).
   */
  useEffect(() => {
    if (!productos?.length) return;
    productosRef.current = productos;
    const timer = setTimeout(async () => {
      try {
        setSyncStatus("loading");
        if (url !== "casa" && url !== "area2area" && url !== "deuda") {
          const syncSuccessful = await syncProducts(url, productos);
          const [desgOk, casaOk, deudaOk] = await Promise.all([validateDesglose(), validateCasa(), validateDeuda()]);
          setIsDesgloseValid(Boolean(desgOk));
          setIsCasaValid(Boolean(casaOk));
          setIsDeudaValid(Boolean(deudaOk));
          if (syncSuccessful) {
            setSyncStatus("success");
          } else {
            setSyncStatus("error");
          }
        }
      } catch {
        setSyncStatus("error");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [productos, url]);

  /**
   * Asegura que cuando cambie `countTimes` se reestructuren las counts de cada producto correctamente.
   */
  /**
 * Asegura que cada producto tenga la propiedad `counts` con la longitud correcta (countTimes)
 * y recalcula `quantity` como suma de counts (o primera entrada).
 */
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
  useEffect(() => {
    if (!productos.length) return;
    setProductos((prev) => ensureCountsShape(prev, countTimes));
  }, [countTimes, ensureCountsShape, productos.length]);

  /* ============================
     Funciones auxiliares de manipulación de datos
     ============================ */



  /**
   * Carga productos y, si url === 'casa', prefill con las cantidades guardadas en CASA_DATA_KEY.
   * @param ctForShape opcional - número de columnas de conteo a forzar en el prefill
   */
  const load = async (ctForShape?: number) => {
    setLoadingItems(true);
    try {
      // Validación mínima: selectedLocal y selectedResponsable deben existir
      const areaId = await AsyncStorage.getItem("selectedLocal");
      const areaName = await AsyncStorage.getItem("LOCAL_DENOMINATION");
      const userId = await AsyncStorage.getItem("selectedResponsable");
      if (!areaId || !userId) {
        setLoadingItems(false);
        return router.push({ pathname: "/" });
      }

      // Obtener productos desde servicio
      const saved = await getProductsSaved(url);
      // Construir casaMap { id: quantity }
      let casaMapLocal: Record<string, string> = {};
      try {
        const casaRaw = await AsyncStorage.getItem(CASA_DATA_KEY);
        if (casaRaw) {
          const parsed = JSON.parse(casaRaw);
          console.log("casaParsed", parsed);
          const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
          console.log("items", items);
          for (const it of items) {
            if (it && it.id != null) {
              const q = it.quantity ?? "";
              casaMapLocal[String(it.id)] = String(q).replace(",", ".");
            }
          }
        }
      } catch (e) {
        // si no parsea, dejamos el mapa vacío (no rompemos)
        casaMapLocal = {};
      }
      let deudaMapLocal: Record<string, string> = {};
      try {
        const deudaRaw = await AsyncStorage.getItem(DEUDA_DATA_KEY);
        if (deudaRaw) {
          const parsed = JSON.parse(deudaRaw);
          const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
          for (const it of items) {
            if (it && it.id != null) {
              const q = it.quantity ?? "";
              deudaMapLocal[String(it.id)] = String(q).replace(",", ".");
            }
          }
        }
      } catch (e) {
        // si no parsea, dejamos el mapa vacío (no rompemos)
        deudaMapLocal = {};
      }

      // Prefill: si estamos en url 'casa' usamos casaMap, sino cargamos productos normalmente
      const shaped = saved.map((p: any) => {
        const base = { ...p };
        if (url === "casa") {
          const qFromCasa = casaMapLocal[String(p.id)];
          const qNormalized =
            qFromCasa !== undefined && qFromCasa !== null && qFromCasa !== ""
              ? String(Number(String(qFromCasa).replace(",", ".")))
              : "0";
          const counts = new Array(ctForShape ?? countTimes).fill("");
          counts[0] = qNormalized;
          const total = sumCounts(counts);
          base.counts = counts;
          base.quantity = total ? String(total) : counts[0] || "0";
        }
        if (url === "deuda") {
          const qFromDeuda = deudaMapLocal[String(p.id)];
          const qNormalized =
            qFromDeuda !== undefined && qFromDeuda !== null && qFromDeuda !== ""
              ? String(Number(String(qFromDeuda).replace(",", ".")))
              : "0";
          const counts = new Array(ctForShape ?? countTimes).fill("");
          counts[0] = qNormalized;
          const total = sumCounts(counts);
          base.counts = counts;
          base.quantity = total ? String(total) : counts[0] || "0";
        }
        return base;
      });

      const finalShaped = ensureCountsShape(shaped, ctForShape ?? countTimes);
      setAreaName(areaName)
      setProductos(finalShaped);
      setHasReported(saved.some((p: any) => !!p.reported));
      setCasaMap(casaMapLocal);
      setDeudaMap(deudaMapLocal);
    } catch (e) {
      Alert.alert("Error cargando los productos", String(e));
    } finally {
      setLoadingItems(false);
    }
  };

  /* ============================
     Handlers de cambio / inputs
     ============================ */

  /**
   * actualizarCantidad
   * Actualiza la cantidad global (campo quantity) para un producto por id.
   * Valida formato con cantidadRegex.
   */
  const actualizarCantidad = (id: string, nuevaCantidad: string, maxQuantity = null) => {
    if (!cantidadRegex.test(nuevaCantidad)) return;
    if ((url == "casa" || url == "area2area") && maxQuantity != null && parseFloat(maxQuantity) < parseFloat(nuevaCantidad)) return;
    if (url === "checkout") setHasReported(false);
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, quantity: nuevaCantidad } : p)));
    clear()
  };

  /**
   * actualizarCantidadParcial
   * Actualiza la celda específica dentro de counts (columna) y recalcula total local.
   */
  const actualizarCantidadParcial = useCallback((id: string, countIndex: number, nuevaCantidad: string, maxQuantity = null) => {
    if (!cantidadRegex.test(nuevaCantidad)) return;

    let max = parseFloat(maxQuantity)
    if (url == "casa") max -= parseFloat(deudaMap[id] ?? "0")
    if (url == "deuda") max -= parseFloat(casaMap[id] ?? "0")

    if (url == "casa" && maxQuantity != null && max < parseFloat(nuevaCantidad)) return;
    setProductos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const counts: string[] = Array.isArray(p.counts) ? [...p.counts] : new Array(countTimes).fill("");
        counts[countIndex] = nuevaCantidad;
        const total = sumCounts(counts);
        return { ...p, counts, quantity: total ? String(total) : "" };
      })
    );
    clear()
  }, [casaMap, deudaMap]);

  /**
   * handleSubmit / handleSubmitMulti
   * Helpers para avanzar focus entre inputs (UX).
   */
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

  /* ============================
     UI helpers
     ============================ */



  /**
   * Estilo container por producto: si no tiene price pinta borde rojo.
   */
  const getContainerStyle = (item: any) => {
    if (item.price === null && url !== "request" && url !== "casa")
      return [styles.productoContainer, { borderColor: themeColors.danger, backgroundColor: themeColors.background, borderLeftWidth: item.inUse ? 5 : undefined, }];
    return [styles.productoContainer, { backgroundColor: themeColors.card, borderColor: themeColors.border, borderLeftWidth: item.inUse ? 5 : undefined, borderLeftColor: item.inUse ? themeColors.success : undefined }];
  };

  const productosSinPrecio = productos.some((p) => p.price === null);

  /* ============================
     Acciones (guardar/enviar/mover)
     ============================ */

  /**
   * ejecutarAccion
   * Ejecuta acciones del flujo: Guardar Inicial, Enviar Pedido, Guardar Final, etc.
   */
  const ejecutarAccion = useCallback(async (accion: string) => {
    try {
      if (accion === "Guardar Inicial") {
        await postInicial(productos);
        Alert.alert("Guardado", "Se guardaron las cantidades iniciales");
        setHasReported(true);
      } else if (accion === "Enviar Pedido") {
        await activateRequest(productos);
        Alert.alert("Pedido enviado");
        setHasReported(true);
      } else if (accion === "Guardar Final") {
        await postFinal(productos);
        Alert.alert("Final guardado");
        await AsyncStorage.multiRemove(["selectedLocal", "selectedResponsable"]);
        router.push("/");
      } else if (accion === "Trasladar") {
        console.log(accion);
        await postArea2Area(productos)
        Alert.alert("Solicitud de movimiento enviada");
      }
    } catch (e) {
      Alert.alert("Error", String(e));
    }
  }, [productos, url]);




  /* ============================
     Búsqueda y cálculo de income
     ============================ */

  const filteredProductos = useMemo(() => {
    const q = normalize(query);
    if (!q) return productos;
    return productos.filter((p) => normalize(p.name).includes(q));
  }, [productos, query]);

  /**
   * income: cálculo del importe esperado en esta vista.
   * Fórmula: suma(item.monto) - sum(casaMap[id] * item.price)
   */
  const income = useMemo(() => {
    return productos.reduce((acc, item) => {
      const casaQty = Number(casaMap[item.id] ?? 0);
      const deudaQty = Number(deudaMap[item.id] ?? 0);
      const monto = Number(item.monto || 0);
      const price = Number(item.price || 0);
      console.log({ item, casaQty, deudaQty });
      return acc + monto - casaQty * price - deudaQty * price;
    }, 0);
  }, [productos, casaMap, deudaMap]);
  const handleAction = useCallback(async (accion: string) => {
    try {
      if (accion === "Guardar Final") {
        // comprobamos el desglose al momento (validateDesglose es async)
        const desgOk = await validateDesglose().catch((e) => {
          console.warn("validateDesglose error (handleAction):", e);
          return false;
        });
        const importeOk = Number(income) >= 0;
        productos.map((item) => {
          if (item.sold < 0) {
            console.log(`${item.name.split(" - ")[0]} tiene más unidades vendidas que las disponibles`);
          }
        })
        if (!desgOk || !importeOk) {
          const reasons: string[] = [];
          if (!desgOk && posModeEnabled) reasons.push("el desglose no es válido");
          if (!importeOk && posModeEnabled) reasons.push("el importe es menor que 0");

          const reasonText = reasons.join(" y ");
          const text = `Advertencia: ${reasonText}. ¿Deseas continuar y ejecutar "${accion}" de todos modos?`;
          setConfirmState({ visible: true, accion, text });
          return;
        }
      }

      // caso normal: abrir confirmación estándar
      setConfirmState({ visible: true, accion, text: `¿Desea ${accion}?` });
    } catch (e) {
      // en caso de error inesperado, igual mostramos confirmación por seguridad
      console.warn("handleAction unexpected error:", e);
      setConfirmState({ visible: true, accion, text: `¿Desea ${accion}?` });
    }
  }, [income, productos, posModeEnabled]);
  const comision = useMemo(() => {
    return productos.reduce((acc, item) => {

      const cantidadParaComision = Number(item.sold ?? 0) - Number(casaMap[item.id] ?? 0) - Number(deudaMap[item.id] ?? 0)
      return acc + cantidadParaComision * item.comision;
    }, 0);
  }, [productos, casaMap, deudaMap]);
  /**
   * validateDesglose
   * Lee DESGLOSE_DATA de AsyncStorage y compara totals.totalCaja con el importe calculado en esta vista (income).
   * Retorna true si totals.totalCaja >= income.
   */
  const validateDesglose = useCallback(async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem("DESGLOSE_DATA");
      if (!raw) return false;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return false;

      // acceder a parsed.totals (esperado)
      const totals = parsed.totals ?? null;
      if (!totals || typeof totals !== "object") return false;

      // Normalizar y parsear totalCaja
      const totalCajaRaw = totals.totalCaja ?? totals.total ?? totals.total_caja ?? null;
      if (totalCajaRaw === null || totalCajaRaw === undefined) return false;

      const totalCaja = Number(String(totalCajaRaw).replace(",", "."));
      if (Number.isNaN(totalCaja)) return false;

      const importe = Number(income ?? 0);
      const ganancia = Number(comision ?? 0);
      const transferencia = Number(parsed?.denominations?.Transferencia ?? 0);
      if (Number.isNaN(importe)) return false;

      // Condición: totalCaja >= importe
      return totalCaja >= importe - ganancia - transferencia;
    } catch (e) {
      console.warn("validateDesglose error:", e);
      return false;
    }
  }, [income, comision]);
  /**
   * useFocusEffect: se ejecuta cuando la pantalla toma foco.
   * - Carga configuraciones (COUNT_TIMES, POS_MODE)
   * - Ejecuta validaciones async (desglose y casa)
   * - Carga productos (load)
   */
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const run = async () => {
        // Contador de slots (cuántas columnas de conteo)
        const ctRaw = await AsyncStorage.getItem(COUNT_TIMES_KEY);
        let ct = parseInt(ctRaw || "1", 10);
        if (isNaN(ct) || ct < 1) ct = 1;
        if (!isActive) return;
        setCountTimes(ct);

        // Modo POS (si está activo)
        const posRaw = await AsyncStorage.getItem(POS_MODE_KEY);
        if (!isActive) return;
        setPosModeEnabled(posRaw ? JSON.parse(posRaw) : false);

        // Ejecutar validaciones en paralelo
        const [desgOk, casaOk, deudaOk] = await Promise.all([validateDesglose(), validateCasa(), validateDeuda()]);
        if (!isActive) return;
        setIsDesgloseValid(Boolean(desgOk));
        setIsCasaValid(Boolean(casaOk));
        setIsDeudaValid(Boolean(deudaOk));

        // Cargar productos (prefil desde CASA si aplica)
        if (!selectedLocal?.length && url == "area2area") return
        await load(ct);
      };

      run();

      return () => {
        isActive = false;
      };
    }, [url, validateDesglose, selectedLocal]) // re-run si cambia la ruta o la función validateDesglose
  );

  useEffect(() => {
    if (selectedLocal?.length) load()
  }, [selectedLocal])


  /* ============================
     Validación dinámica de Desglose
     ============================ */

  // La función validateDesglose fue definida arriba (useCallback).
  // Aquí la invocamos cada vez que cambie el income (u otros deps).
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // validateDesglose accede a AsyncStorage y compara DESGLOSE_DATA.totals.totalCaja >= income
        // NOTA: validateDesglose fue declarado con useCallback más arriba.
        const ok = await validateDesglose();
        if (mounted) setIsDesgloseValid(Boolean(ok));
      } catch {
        if (mounted) setIsDesgloseValid(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [income, productos, casaMap, validateDesglose]);

  /* ============================
     Handlers de navegación y guardado "Casa"
     ============================ */

  const onSearchFocus = useCallback(() => {
    if (!query) return;
    setQuery("");
  }, [query]);

  /**
   * saveCasa
   * Construye array [{id, quantity}] de productos con cantidad > 0 y lo guarda en CASA_DATA_KEY
   * También guarda INITIAL_COUNTS_KEY y navega a final.
   */
  const saveCasa = async () => {
    try {
      const items = productos.reduce((acc: { id: any; quantity: string }[], p) => {
        // obtener quantity priorizando p.quantity; si vacío, sumar p.counts
        let q = p.quantity;
        if (q === undefined || q === null || q === "") {
          if (Array.isArray(p.counts) && p.counts.length) {
            const s = sumCounts(p.counts);
            q = s ? String(s) : "";
          } else {
            q = "";
          }
        }
        const n = Number(String(q).replace(",", "."));
        if (!isNaN(n) && n > 0) {
          acc.push({ id: p.id, quantity: String(n) });
        }
        return acc;
      }, []);

      const meta = { savedAt: new Date().toISOString() };
      await AsyncStorage.setItem(CASA_DATA_KEY, JSON.stringify({ meta, items }));

      Alert.alert("Guardado", "Los datos de Casa y las cantidades iniciales se guardaron correctamente.");
      await AsyncStorage.removeItem("DESGLOSE_DATA")
      router.push({ pathname: "/(tabs)/final" });
      setIsCasaValid(true);
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar Casa: " + String(e));
    }
  };
  const saveDeuda = async () => {
    try {
      const items = productos.reduce((acc: { id: any; quantity: string }[], p) => {
        // obtener quantity priorizando p.quantity; si vacío, sumar p.counts
        let q = p.quantity;
        if (q === undefined || q === null || q === "") {
          if (Array.isArray(p.counts) && p.counts.length) {
            const s = sumCounts(p.counts);
            q = s ? String(s) : "";
          } else {
            q = "";
          }
        }
        const n = Number(String(q).replace(",", "."));
        if (!isNaN(n) && n > 0) {
          acc.push({ id: p.id, quantity: String(n) });
        }
        return acc;
      }, []);

      const meta = { savedAt: new Date().toISOString() };
      await AsyncStorage.setItem(DEUDA_DATA_KEY, JSON.stringify({ meta, items }));

      Alert.alert("Guardado", "Los datos de Deuda se guardaron correctamente.");
      await AsyncStorage.removeItem("DESGLOSE_DATA")
      router.push({ pathname: "/(tabs)/final" });
      setIsCasaValid(true);
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar Casa: " + String(e));
    }
  };

  /* ============================
     Navegación a Desglose / Casa
     ============================ */

  const onPressDesglose = useCallback(() => {
    // Navega a la pantalla de desgloce, pasando importe y comision (ejemplo comision=10).
    router.push({ pathname: "/desgloce", params: { importe: income, comision } });
  }, [income, comision]);

  const onPressCasa = () => {
    router.push({ pathname: "/casa" });
  };
  const onPressDeuda = () => {
    router.push({ pathname: "/deuda" });
  };

  /* ============================
     Flags y estilos dinámicos para botones
     ============================ */

  const desgloseBg = isDesgloseValid ? themeColors.success : themeColors.warning;
  const casaBg = isCasaValid ? themeColors.success : themeColors.warning;
  const deudaBg = isDeudaValid ? themeColors.success : themeColors.warning;
  const toAreaNResponsableBg = responsable && selectedLocal ? themeColors.success : themeColors.warning;

  // Guardar final habilitado sólo si ambas validaciones son true y income >= 0
  const canSaveFinal = true
  // const canSaveFinal = (posModeEnabled && isDesgloseValid && isCasaValid && income >= 0) || (!posModeEnabled && income >= 0);

  // Existe al menos una cantidad > 0
  const hasCasaQuantities = useMemo(() => {
    return productos.some((p) => {
      let q = p.quantity;
      if (q === undefined || q === null || q === "") {
        if (Array.isArray(p.counts) && p.counts.length) {
          const s = sumCounts(p.counts);
          q = s ? String(s) : "";
        }
      }
      const n = Number(String(q ?? "").replace(",", "."));
      return !isNaN(n) && n > 0;
    });
  }, [productos, countTimes]);

  /* ============================
     Componentes/Render helpers para la UI
     ============================ */

  const TotalInline = ({ value }: { value: string }) => (
    <Text style={[styles.totalTextInline, { color: themeColors.accent }]}>Total: {value || "0"}</Text>
  );

  const TotalBadgeRight = ({ value }: { value: string }) => (
    <View style={[styles.totalBadge, { borderColor: themeColors.accent }]}>
      <Text style={[styles.totalBadgeText, { color: themeColors.accent }]} numberOfLines={1}>
        Total: {value || "0"}
      </Text>
    </View>
  );

  /**
   * CountsRight: fila de inputs cuando el layout no está "stacked"
   */
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
                inputMode="decimal"
                editable={editable}
                value={Number(val) === 0 ? "" : val?.toString()}
                placeholder="0"
                onChangeText={(text) => actualizarCantidadParcial(item.id, cIdx, text, item.sold)}
                onSubmitEditing={() => handleSubmitMulti(prodIndex, cIdx, filteredProductos.length)}
                placeholderTextColor="#888"
                returnKeyType="next"
              />
            );
          })}
        </View>
      </View>
    );
  };

  /**
   * CountsStack: inputs apilados (cuando countTimes >= 3)
   */
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
              inputMode="decimal"
              editable={editable}
              value={Number(val) === 0 ? "" : val?.toString()}
              placeholder="0"
              onChangeText={(text) => actualizarCantidadParcial(item.id, cIdx, text, item.sold)}
              onSubmitEditing={() => handleSubmitMulti(prodIndex, cIdx, filteredProductos.length)}
              placeholderTextColor="#888"
              returnKeyType="next"
            />
          );
        })}
      </View>
    );
  };

  const renderSync = () => {
    if (syncStatus === "loading")
      return <ActivityIndicator size={25} color={themeColors.primary} />;

    if (syncStatus === "success")
      return <MaterialIcons name="check-circle" size={25} color={themeColors.success} />;

    if (syncStatus === "error")
      return <MaterialIcons name="error" size={25} color={themeColors.danger} />;
  };
  const renderServerStatus = () => {
    return trying ? <ActivityIndicator size={25} color={themeColors.primary} /> : serverOnline ? (
      <MaterialIcons name="cloud-done" size={28} color={themeColors.success} />
    ) : (
      <MaterialIcons name="cloud-off" size={28} color={themeColors.danger} />
    );
  };

  /**
   * Bloque con información del producto (nombre, stock, contenido neto...)
   */
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
      {(url === "request") && (
        <Text style={{ color: themeColors.text, fontWeight: "bold" }}>Disponible en área: {item.disponible}</Text>
      )}
      {(url === "final" || url == "area2area") && (
        <Text style={{ color: themeColors.text, fontWeight: "bold" }}>{url === "final" ? "Consumido" : "Máximo"}: {item.sold}</Text>
      )}
      {(url === "casa" || url == "deuda") && (
        <Text style={{ color: themeColors.text, fontWeight: "bold" }}>Máximo: {url == "casa" ? (item.sold - parseFloat(deudaMap[item.id] ?? "0")) : (item.sold - parseFloat(casaMap[item.id] ?? "0"))}</Text>
      )}
      {children}
    </View>
  );

  /**
   * renderItem: renderiza cada item de la lista según la ruta (initial/final/casa/otros).
   * - initial/final -> multiple counts (isMulti)
   * - casa/otros -> input simple
   */
  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const isMulti = url === "initial" || url === "final";
      const stacked = isMulti && countTimes >= 3;
      const showTotal = isMulti && countTimes > 1;
      const inUse = item.inUse
      if (!isMulti) {
        // vista simplificada (no multiple counts)
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
                inputMode="decimal"
                editable={!((url === "initial" || url === "request") && hasReported)}
                value={Number(item.quantity) === 0 ? "" : item.quantity?.toString()}
                placeholder="0"

                onChangeText={(text) => actualizarCantidad(item.id, text, item.sold)}
                onSubmitEditing={() => handleSubmit(index, filteredProductos.length)}
                blurOnSubmit={false}
                placeholderTextColor="#888"
                returnKeyType="next"
              />
            </View>
          </View>
        );
      }

      if (!stacked) {
        // isMulti pero no apilado: mostrar counts a la derecha
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

      // stacked layout (columnas apiladas)
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

  /* ============================
     Confirm dialog component
     ============================ */

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

  /* ============================
     Render principal
     ============================ */

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: themeColors.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={60}
      >
        <View style={{ flex: 1, paddingTop: url === "casa" ? 25 : "auto" }}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: themeColors.card }]}>
            <View style={styles.headerTopRow}>
              <Text style={[styles.titleSmall, { color: themeColors.text }]} numberOfLines={1} ellipsizeMode="tail">
                {title}{areaName ? `: ${areaName}` : ""}
              </Text>
              <View style={styles.topRight}>
                <View style={{ marginRight: 4 }}>
                  {renderSync()}
                </View>
                {renderServerStatus()}
                <TouchableOpacity onPress={() => setHelpVisible(true)} style={[styles.actionButton, { backgroundColor: themeColors.primary }]}>
                  <Text style={styles.actionText}>Ayuda</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Banner de advertencia si hay productos sin precio */}
            {productosSinPrecio && url !== "request" && url !== "casa" && (
              <View style={styles.warningBanner}>
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                  ⚠️ Los productos con el borde rojo no tienen precio asignado, el importe debe calcularse manualmente para estos. (Marcados en rojo)
                </Text>
              </View>
            )}

            {/* Row inferior del header: búsqueda + acciones */}
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
                {/* Botón actualizar: recarga productos */}
                <TouchableOpacity onPress={() => load(countTimes)} style={[styles.actionButton, { backgroundColor: themeColors.primary }]}>
                  <Text style={styles.actionText}>Actualizar</Text>
                </TouchableOpacity>

                {/* Guardar Casa (visible sólo en la ruta 'casa') */}
                {url === "casa" && (
                  <TouchableOpacity
                    onPress={saveCasa}
                    style={[
                      styles.actionButton,
                      !hasCasaQuantities && styles.disabledButton,
                      { backgroundColor: themeColors.primary },
                    ]}
                  >
                    <Text style={[styles.actionText]}>Guardar Casa</Text>
                  </TouchableOpacity>
                )}
                {url === "deuda" && (
                  <TouchableOpacity
                    onPress={saveDeuda}
                    style={[
                      styles.actionButton,
                      // !hasCasaQuantities && styles.disabledButton,
                      { backgroundColor: themeColors.primary },
                    ]}
                  >
                    <Text style={[styles.actionText]}>Guardar Deuda</Text>
                  </TouchableOpacity>
                )}

                {/* Botones según ruta */}
                {url === "initial" && (
                  <TouchableOpacity
                    onPress={() => !hasReported && handleAction("Guardar Inicial")}
                    style={[styles.actionButton, hasReported && styles.disabledButton, { backgroundColor: hasReported ? themeColors.disabled : themeColors.primary }]}
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
                    style={[styles.actionButton, hasReported && styles.disabledButton, { backgroundColor: hasReported ? themeColors.disabled : themeColors.primary }]}
                    disabled={hasReported}
                  >
                    <Text style={[styles.actionText, hasReported && styles.disabledText]}>
                      {hasReported ? "En espera" : "Confirmar Pedido"}
                    </Text>
                  </TouchableOpacity>
                )}

                {url === "final" && (
                  <TouchableOpacity
                    onPress={() => handleAction("Guardar Final")}
                    style={[
                      styles.actionButton,
                      (!canSaveFinal) && styles.disabledButton,
                      { backgroundColor: canSaveFinal ? themeColors.primary : themeColors.disabled },
                    ]}
                    disabled={!canSaveFinal}
                  >
                    <Text style={[styles.actionText, (!canSaveFinal) && styles.disabledText]}>Guardar Final</Text>
                  </TouchableOpacity>
                )}
                {url === "area2area" && (
                  <TouchableOpacity
                    onPress={() => handleAction("Trasladar")}
                    style={[
                      styles.actionButton,
                      (!selectedLocal && !responsable) && styles.disabledButton,
                      { backgroundColor: (!selectedLocal && !responsable) ? themeColors.disabled : themeColors.primary },
                    ]}
                    disabled={(!selectedLocal && !responsable)}
                  >
                    <Text style={[styles.actionText, ((!selectedLocal && !responsable)) && styles.disabledText]}>Trasladar</Text>
                  </TouchableOpacity>)
                }
              </View>
            </View>

            {/* IMPORTANTE: Mostrar Importe y botones sólo cuando url === 'final' AND modo punto de venta activo */}
            {url === "final" && posModeEnabled && (
              <View style={[styles.importRow, { borderColor: themeColors.border, marginTop: 8 }]}>
                <Text style={[styles.importText, { color: themeColors.text }]}>Importe (venta-ganancia): ${income - comision}</Text>

                <View style={styles.buttonsRow}>
                  <TouchableOpacity
                    onPress={onPressDesglose}
                    style={[
                      styles.smallButton,
                      { backgroundColor: !isCasaValid ? themeColors.disabled : desgloseBg },
                      !isDesgloseValid && { opacity: 0.9 },
                    ]}
                    disabled={!isCasaValid}
                  >
                    <Text style={styles.actionText}>Desglose</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={onPressCasa}
                    style={[
                      styles.smallButton,
                      { backgroundColor: casaBg },
                      !isCasaValid && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={styles.actionText}>Casa</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onPressDeuda}
                    style={[
                      styles.smallButton,
                      { backgroundColor: deudaBg },
                      !isDeudaValid && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={styles.actionText}>Deuda</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {url === "area2area" && (
              <View style={[styles.importRow, { borderColor: themeColors.border, marginTop: 8 }]}>
                {/* <Text style={[styles.importText, { color: themeColors.text }]}>Importe (venta-ganancia): ${income - comision}</Text> */}

                <View style={styles.buttonsRow}>
                  <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    style={[
                      styles.smallButton,
                      { backgroundColor: toAreaNResponsableBg },
                      !isDesgloseValid && { opacity: 0.9 },
                    ]}
                  // disabled={!isCasaValid}
                  >
                    <Text style={styles.actionText}>Seleccione el área y quien va a recibir</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    // onPress={onPressCasa}
                    style={[
                      styles.smallButton,
                      { backgroundColor: casaBg },
                      !isCasaValid && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={styles.actionText}>Editar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Loader overlay mientras cargan los items */}
          {loadingItems && (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator size="large" color={themeColors.primary} />
            </View>
          )}

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
        text={confirmState.text ?? `¿Desea ${confirmState.accion}?`}
        onCancel={() => setConfirmState({ visible: false })}
        onConfirm={() => {
          const a = confirmState.accion!;
          setConfirmState({ visible: false });
          ejecutarAccion(a);
        }}
      />
      <ModalSeleccionLocal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onConfirm={(local, responsable) => {
          setSelectedLocal(local);
          setSelectedResponsable(responsable);
          setModalVisible(false);
        }}
      />

    </>
  );
}

/* ============================
   Estilos
   ============================ */

const styles = StyleSheet.create({
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

  infoLeft: {
    flex: 1,
    flexShrink: 1,
  },
  infoSixty: {
    flex: 3,
  },

  nombre: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    flexWrap: "wrap",
  },

  totalTextInline: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "800",
  },

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

  rightForty: {
    flex: 2,
  },
  countsRightInner: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  countsRowStack: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  countInputBase: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    textAlign: "right",
    marginBottom: 8,
  },

  countInputStack: {
    width: "30%",
    minWidth: 80,
  },

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

  importRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },

  buttonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    minWidth: 88,
    alignItems: "center",
    justifyContent: "center",
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

  // loader overlay
  loaderOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
    zIndex: 1000,
  },
  innerMarker: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4, // grosor del marcador
    backgroundColor: "#ed4341", // cámbialo al color del tema si deseas
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
});
