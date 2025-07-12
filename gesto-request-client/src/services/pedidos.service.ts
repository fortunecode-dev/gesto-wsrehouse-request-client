import { API_URL } from "@/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { router } from "expo-router";
export const getProducts = async () => {
  try {
    const areaId = await AsyncStorage.getItem('selectedLocal');

    const { data } = await axios.get(`${API_URL}/request/products/${areaId}`)
    return data
  } catch (error) {
    router.push({ pathname: "/" })
    AsyncStorage.removeItem("selectedLocal")
    return []
  }

}
export const getRequestId = async (userId, areaId) => {
  try {
    const { data } = await axios.get(`${API_URL}/request/${userId}/${areaId}`)
    await AsyncStorage.setItem('requestId', data.id);
  } catch (error) {

    return ""
  }

}
export const getProductsSaved = async (url) => {
  try {
    const param = await AsyncStorage.getItem(url == "request" || url == "checkout" ? 'requestId' : "selectedLocal");
    if (param == null)
      return router.push({ pathname: `${url == "checkout" ? "/pedidos" : "/"}` })
    const { data } = await axios.get(`${API_URL}/request/products/saved/${url}/${param}`)
    return data
  } catch (error) {
    router.push({ pathname: "/" })
    AsyncStorage.removeItem("selectedLocal")
    return []
  }

}
export const getEmployes = async (areaId) => {
  try {
    const { data } = await axios.get(`${API_URL}/get-employes-by-area/${areaId}`)
    return data
  } catch (error) {
    return []
  }

}
export const getAreas = async () => {
  try {
    const { data } = await axios.get(`${API_URL}/areas-local`)
    return data
  } catch (error) {
    return []
  }
}

export const syncProducts = async (url: string, productos: any[]) => {
  try {
    const requestId = await AsyncStorage.getItem('requestId');
    const areaId = await AsyncStorage.getItem('selectedLocal');
    const response = await axios.post(`${API_URL}/request/sync/${url}`, { productos, requestId, areaId });
    return response.data;
  } catch (error) {
    router.push({ pathname: "/" })
    AsyncStorage.removeItem("selectedLocal")
    return []
  }
};
export const activateRequest = async () => {
  try {
    const requestId = await AsyncStorage.getItem('requestId');
    const response = await axios.post(`${API_URL}/request/send-to-warehouse/${requestId}`);
    return response.data;
  } catch (error) {
    return []
  }
};

export const makeMovement = async () => {
  try {
    const requestId = await AsyncStorage.getItem('requestId');
    const response = await axios.post(`${API_URL}/request/make-movement/${requestId}`);
    return response.data;
  } catch (error) {
    return []
  }
};


export const getActiveRequests = async () => {
  try {
    const response = await axios.get(`${API_URL}/request/list`);
    return response.data;

  } catch (error) {

    return []
  }
};
export const postInicial = async () => {
  try {
    const areaId = await AsyncStorage.getItem('selectedLocal');
    const response = await axios.post(`${API_URL}/request/post/initial`, { areaId });
    return response.data;
  } catch (error) {
    return []
  }
};
export const postFinal = async () => {
  try {
    const areaId = await AsyncStorage.getItem('selectedLocal');
    const response = await axios.post(`${API_URL}/request/post/final`, { areaId });
    return response.data;

  } catch (error) {
    return []
  }
};
export const getObservation = async (selectedResponsable, selectedLocal) => {
  try {
    const response = await axios.get(`${API_URL}/employe/observation/${selectedLocal}/${selectedResponsable}`);
    return response.data.observation;
  } catch (error) {
    return []
  }
};
export const saveObservation = async (selectedResponsable, selectedLocal,observations) => {
  try {
     const response = await axios.post(`${API_URL}/employe/observation/${selectedLocal}/${selectedResponsable}`,{observations});
    return response.data;
  } catch (error) {
    return []
  }
};