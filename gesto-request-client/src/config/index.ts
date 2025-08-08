import AsyncStorage from "@react-native-async-storage/async-storage";

// src/config/server.ts
export const API_URL = async () => {
    const server = await AsyncStorage.getItem('SERVER_URL');
    if (server) return server
    return process.env.EXPO_PUBLIC_API_URL || "http://192.168.10.145/api";
}
