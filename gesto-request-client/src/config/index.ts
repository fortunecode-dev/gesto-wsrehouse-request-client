import AsyncStorage from "@react-native-async-storage/async-storage";

// src/config/server.ts
export const API_URL =async ()=>{
    const server = await AsyncStorage.getItem('server');
    if(server)return server
   return   process.env.EXPO_PUBLIC_API_URL || "http://10.147.144.87:4000";
}
