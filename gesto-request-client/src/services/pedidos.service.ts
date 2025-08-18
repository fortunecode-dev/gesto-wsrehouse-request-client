import { API_URL } from "@/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { router } from "expo-router";

export const getProducts = async () => {
  try {
    const areaId = await AsyncStorage.getItem('selectedLocal');
    const { data } = await axios.get(`${await API_URL()}/request/products/${areaId}`)
    return data
  } catch (error) {
    router.push({ pathname: "/" })
    AsyncStorage.removeItem("selectedLocal")
    return []
  }
}

export const getProductsSaved = async (url) => {
  try {
    const areaId = await AsyncStorage.getItem('selectedLocal');
    const userId = await AsyncStorage.getItem('selectedResponsable');
    if (areaId == null || userId === null)
      return router.push({ pathname: "/" })
    const { data } = await axios.get(`${await API_URL()}/request/products/saved/${url}/${areaId}`)
    return data
  } catch (error) {
    AsyncStorage.removeItem("selectedLocal")
    AsyncStorage.removeItem("selectedResponsable")
    AsyncStorage.removeItem("requestId")
    router.push({ pathname: "/" })
    return []
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
    const parsed= productos.map(item=>({...item, quantity:item.quantity[item.quantity.length-1]==="."?item.quantity.slice(item.quantity.length-1):item.quantity}))
    const response = await axios.post(`${await API_URL()}/request/sync/${url}`, { productos, userId, areaId });
    return response.data;
  } catch (error) {
    router.push({ pathname: "/" })
    AsyncStorage.removeItem("selectedLocal")
    return []
  }
};
export const activateRequest = async () => {
  try {
    const areaId = await AsyncStorage.getItem('selectedLocal');

    const response = await axios.post(`${await API_URL()}/request/send-to-warehouse/${areaId}`);
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
export const postInicial = async () => {
  try {
    const areaId = await AsyncStorage.getItem('selectedLocal');
    const userId = await AsyncStorage.getItem('selectedResponsable');

    const response = await axios.post(`${await API_URL()}/request/post/initial`, { areaId, userId });
    return response.data;
  } catch (error) {
    throw JSON.stringify(error)
  }
};
export const postFinal = async () => {
  try {
    const areaId = await AsyncStorage.getItem('selectedLocal');
    const userId = await AsyncStorage.getItem('selectedResponsable');
    const response = await axios.post(`${await API_URL()}/request/post/final`, { areaId, userId });
    return response.data;
  } catch (error) {
    throw JSON.stringify(error)
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