import { API_URL } from "@/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { subDays } from "date-fns";
import { router } from "expo-router";

export const getProductsSaved = async (url) => {
  try {
    if (url == "casa")
      url = "final"
    const areaId = await AsyncStorage.getItem('selectedLocal');
    const userId = await AsyncStorage.getItem('selectedResponsable');
    const toAreaId = await AsyncStorage.getItem('selectedToLocal');
    if (areaId == null || userId == null) {
      return router.push({ pathname: "/" })
    }
    const { data } = await axios.get(`${await API_URL()}/request/products/saved/${url}/${areaId}`,{params:{toAreaId}})
    return data
  } catch (error) {
    console.log("getProductsSaved error return", error);
    AsyncStorage.removeItem("selectedLocal")
    AsyncStorage.removeItem("selectedResponsable")
    router.push({ pathname: "/" })
    return []
  }
}

export const getPendingTransfer = async () => {
  try {
    const areaId = await AsyncStorage.getItem('selectedLocal');
    if (areaId == null) {
      return router.push({ pathname: "/" })
    }
    const { data } = await axios.get(`${await API_URL()}/request/products/recibe/area2area/${areaId}`)
    return data
  } catch (error) {
    console.log("getProductsSaved error return", error);
    AsyncStorage.removeItem("selectedLocal")
    AsyncStorage.removeItem("selectedResponsable")
    router.push({ pathname: "/" })
    return []
  }
}

export const receiveTransfer = async () => {
  try {
   const areaId = await AsyncStorage.getItem('selectedLocal');
    if (areaId == null) {
      return router.push({ pathname: "/" })
    }
    const { data } = await axios.post(`${await API_URL()}/request/products/recibe/area2area/${areaId}`)
    return true
  } catch (error) {
    console.log("getProductsSaved error return", error);
    AsyncStorage.removeItem("selectedLocal")
    AsyncStorage.removeItem("selectedResponsable")
    router.push({ pathname: "/" })
    return false
  }
}

export const getEmployes = async (areaId) => {
  try {
    const { data } = await axios.get(`${await API_URL()}/get-employes-by-area/${areaId}`)
    return data
  } catch (error) {
    return null
  }

}
export const getAreas = async () => {
  try {
    const { data } = await axios.get(`${await API_URL()}/areas-local`)
    return data
  } catch (error) {
    return null
  }
}

export const syncProducts = async (url: string, productos: any[]) => {
  try {
    const userId = await AsyncStorage.getItem('selectedResponsable');
    const areaId = await AsyncStorage.getItem('selectedLocal');
    const parsed = productos.map(item => ({ ...item, quantity: item.quantity?.[item.quantity?.length - 1] === "." || item.quantity?.[item.quantity?.length - 1] === "," ? item.quantity.slice(item.quantity.length - 1) : item.quantity }))
    const response = await axios.post(`${await API_URL()}/request/sync/${url}`, { productos, userId, areaId });
    return response.data;
  } catch (error) {
    console.log("syncProducts return", url, error)
    router.push({ pathname: "/" })
    AsyncStorage.removeItem("selectedLocal")
    AsyncStorage.removeItem("selectedResponsable")
    return []
  }
};
export const activateRequest = async (productos) => {
  try {
    const areaId = await AsyncStorage.getItem('selectedLocal');
    const response = await axios.post(`${await API_URL()}/request/send-to-warehouse/${areaId}`, { productos });
    return response.data;
  } catch (error) {
    throw JSON.stringify(error)
  }
};

export const makeMovement = async () => {
  try {
    const areaId = await AsyncStorage.getItem('selectedLocal');
    const response = await axios.post(`${await API_URL()}/request/make-movement/${areaId}`);
    return response.data;
  } catch (error) {
    return []
  }
};


export const getActiveRequests = async () => {
  try {
    const response = await axios.get(`${await API_URL()}/request/list`);
    return response.data;

  } catch (error) {

    return []
  }
};
export const postInicial = async (productos) => {
  try {
    const areaId = await AsyncStorage.getItem('selectedLocal');
    const userId = await AsyncStorage.getItem('selectedResponsable');

    const response = await axios.post(`${await API_URL()}/request/post/initial`, { productos, areaId, userId });
    return response.data;
  } catch (error) {
    throw JSON.stringify(error)
  }
};

// helpers de validación

/** Comprueba si una cadena representa una fecha válida */
function isValidDateString(s: any): boolean {
  if (!s) return false;
  const d = new Date(String(s));
  return !Number.isNaN(d.getTime());
}

/** Valida la estructura mínima esperada para CASA_DATA */
function isValidCasaObject(obj: any): boolean {
  try {
    if (!obj || typeof obj !== "object") return false;

    // meta.savedAt debe ser una fecha válida
    const savedAt = obj?.meta?.savedAt;
    if (!isValidDateString(savedAt)) return false;

    // items debe ser un array
    const items = Array.isArray(obj.items) ? obj.items : null;
    if (!items) return false;

    // cada item debe tener id y quantity numérico (o parseable) >= 0
    for (const it of items) {
      if (!it || typeof it !== "object") return false;
      if (it.id === undefined || it.id === null) return false;
      const q = Number(String(it.quantity ?? it.qty ?? "").replace(",", "."));
      if (Number.isNaN(q) || q < 0) return false;
    }

    return true;
  } catch {
    return false
  }

}

/** Valida la estructura mínima esperada para DESGLOSE_DATA */
function isValidDesgloseObject(obj: any): boolean {
  try {
    if (!obj || typeof obj !== "object") return false;

    const totals = obj.totals ?? null;
    if (!totals || typeof totals !== "object") return false;

    // buscar campo de total de caja en varias claves comunes
    const totalCajaRaw = totals.totalCaja ?? null;
    if (totalCajaRaw === null || totalCajaRaw === undefined) return false;

    const totalCaja = Number(String(totalCajaRaw).replace(",", "."));
    if (Number.isNaN(totalCaja) || !Number.isFinite(totalCaja)) return false;

    return true;
  } catch {
    return false
  }

}

/**
 * postFinal
 * Valida CASA_DATA y DESGLOSE_DATA como objetos válidos.
 * - Si las validaciones fallan: devuelve false.
 * - Si son válidos: hace POST al endpoint con los objetos parseados.
 */
export const postFinal = async (productos) => {
  try {
    // validar contexto mínimo
    const areaId = await AsyncStorage.getItem("selectedLocal");
    const userId = await AsyncStorage.getItem("selectedResponsable");

    if (!areaId || !userId) {
      // falta contexto imprescindible: retornar false para que el caller lo maneje
      return false;
    }

    // leer raw desde storage
    const casaRaw = await AsyncStorage.getItem("CASA_DATA");
    const desgloseRaw = await AsyncStorage.getItem("DESGLOSE_DATA");

    // parsear y validar ambos
    let casaParsed: any = null;
    let desgloseParsed: any = null;

    try {
      casaParsed = casaRaw ? JSON.parse(casaRaw) : null;
    } catch (e) {
      // parse error -> invalida
      casaParsed = null;
    }
    try {
      desgloseParsed = desgloseRaw ? JSON.parse(desgloseRaw) : null;
    } catch (e) {
      desgloseParsed = null;
    }
    // Validaciones estrictas: si alguna falla -> retornar false
    if (!isValidCasaObject(casaParsed)) {
      casaParsed = null
    }
    if (!isValidDesgloseObject(desgloseParsed)) {
      desgloseParsed = null
    }
    if (desgloseParsed) {
      delete desgloseParsed.denominations._PROPINA_OVERRIDE
    }
    // Si todo ok, enviamos el POST con los objetos ya parseados
    const url = `${await API_URL()}/request/post/final`;
    const response = await axios.post(url, {
      areaId,
      userId,
      casa: casaParsed,
      desglose: desgloseParsed,
      productos
    });

    return response.data;
  } catch (error) {
    console.log(error);
    // conservar el comportamiento anterior: propagar el error (stringify para consistencia)
    throw JSON.stringify(error);
  }
};
export const postArea2Area = async (productos) => {
  try {
    // validar contexto mínimo
    const fromAreaId = await AsyncStorage.getItem("selectedLocal");
    const toAreaId = await AsyncStorage.getItem("selectedToLocal");
    const userId = await AsyncStorage.getItem("selectedToResponsable");

    if (!fromAreaId || !userId || !toAreaId) {
      console.log("Falta por asignar:",!toAreaId?"El area de destino":"");
      console.log("Falta por asignar:",!userId?"El usuario de destino":"");
      // falta contexto imprescindible: retornar false para que el caller lo maneje
      return false;
    }
    const url = `${await API_URL()}/request/post/area2area`;
    const response = await axios.post(url, {
      fromAreaId,
      toAreaId,
      userId,
      productos
    });

    return response.data;
  } catch (error) {
    console.log(error);
    // conservar el comportamiento anterior: propagar el error (stringify para consistencia)
    throw JSON.stringify(error);
  }
};
export const fetchMovements = async () => {
  try {
    const areaId = await AsyncStorage.getItem("selectedLocal");
    if (!areaId) return [];
    await axios.post(`${await API_URL()}/login`, { username: "admin", password: "1234" });

    const filterStart = subDays(new Date().setHours(0, 0, 0, 0), 1).toISOString();
    const filterEnd = (new Date()).toISOString();
    const url = `${await API_URL()}/inventory-movements`;
    const response = await axios.get(url, { params: { areaId, filterStart, filterEnd } });
    return response.data; // asumimos que la API devuelve un array de Movement
  } catch (error) {
    console.warn("Error fetching movements:", error);
    throw error;
  }
};

export const saveObservation = async (selectedResponsable, selectedLocal, observations) => {
  try {
    const response = await axios.post(`${await API_URL()}/employe/observation/${selectedLocal}`, { selectedResponsable, observations });
    return response.data;
  } catch (error) {
    throw error
  }
};
export const getObservation = async (selectedLocal) => {
  try {
    const response = await axios.get(`${await API_URL()}/employe/observation/${selectedLocal}`);
    return response.data;
  } catch (error) {
    throw error
  }
};