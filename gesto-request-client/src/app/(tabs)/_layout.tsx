import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Tabs, router, usePathname } from 'expo-router';
import { Platform, useWindowDimensions, Text, TouchableOpacity, Animated, Pressable } from 'react-native';
import 'react-native-reanimated';
import "../../global.css";
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider, useAppTheme } from '@/providers/ThemeProvider';
import React, { useRef, useState } from "react";

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme();
  const pathname = usePathname();
  const isDark = theme === 'dark';
  const isSmallDevice = width < 360;

  const activeColor = isDark ? '#60A5FA' : '#2563EB';
  const inactiveColor = isDark ? '#9CA3AF' : '#94A3B8';
  const backgroundColor = isDark ? '#1F2937' : '#F9FAFB';

  // Drawer state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-280)).current;

  const openDrawer = () => {
    setDrawerVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(slideAnim, {
      toValue: -280,
      duration: 180,
      useNativeDriver: false,
    }).start(() => setDrawerVisible(false));
  };

  const menuItems = [
    { label: "Historial de movimientos", route: "history", icon: <Feather name="clock" size={22} /> },
    { label: "Movimiento entre áreas", route: "area2area", icon: <MaterialCommunityIcons name="swap-horizontal-bold" size={22} /> },
    { label: "Recibir de un área", route: "pending", icon: <MaterialIcons name="pending-actions" size={22} /> },
    { label: "Ajustes", route: "ajustes", icon: <Feather name="settings" size={22} /> },
  ];

  return (
    <ThemeProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor }}>

        {/* ========================== */}
        {/*      OVERLAY DEL DRAWER    */}
        {/* ========================== */}
        {drawerVisible && (
          <Pressable
            onPress={closeDrawer}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
              zIndex: 30,
            }}
          />
        )}

        {/* ========================== */}
        {/*          SIDEBAR           */}
        {/* ========================== */}
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: slideAnim,
            width: 260,
            bottom: 0,
            backgroundColor,
            paddingTop: 60,
            paddingHorizontal: 20,
            zIndex: 40,
            elevation: 10,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 10,
          }}
        >
          <Text
            style={{
              color: isDark ? "#fff" : "#000",
              fontWeight: "700",
              fontSize: 20,
              marginBottom: 20,
            }}
          >
            Menú
          </Text>

          {menuItems.map((item, idx) => {
            const isActive =
              pathname === `/${item.route}` || pathname.startsWith(`/${item.route}/`);

            return (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  closeDrawer();
                  router.push(item.route as any);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 10,
                  borderRadius: 8,

                  // ESTILO SI ESTÁ ACTIVO
                  backgroundColor: isActive
                    ? (isDark ? "rgba(96,165,250,0.25)" : "rgba(37,99,235,0.15)")
                    : "transparent",
                }}
              >
                {/* icono con color dinámico */}
                {React.cloneElement(item.icon, {
                  color: isActive ? activeColor : inactiveColor,
                })}

                <Text
                  style={{
                    color: isActive ? activeColor : (isDark ? "#fff" : "#000"),
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* ========================== */}
        {/*            TABS            */}
        {/* ========================== */}
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: activeColor,
            tabBarInactiveTintColor: inactiveColor,
            tabBarLabelStyle: {
              fontSize: isSmallDevice ? 13 : 15,
              fontWeight: '700',
              marginBottom: Platform.OS === 'android' ? 4 : 2,
            },
            tabBarItemStyle: {
              flexDirection: 'column',
              paddingVertical: 6,
            },
            tabBarStyle: {
              height: Platform.OS === 'android' ? 70 : 80,
              paddingBottom: Platform.OS === 'android' ? 8 : 12,
              paddingTop: 8,
              backgroundColor,
              borderTopWidth: 0,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              elevation: 0,
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: -2 },
            },
          }}
        >
          {/* ---- TABS VISIBLES ---- */}
          <Tabs.Screen
            name="index"
            options={{
              title: 'Local',
              tabBarIcon: ({ color, focused }) => (
                <MaterialCommunityIcons
                  name="store-outline"
                  size={focused ? 28 : 26}
                  color={color}
                />
              ),
            }}
          />

          <Tabs.Screen
            name="inicio"
            options={{
              title: 'Inicio',
              tabBarIcon: ({ color, focused }) => (
                <MaterialCommunityIcons
                  name="clock-time-eight-outline"
                  size={focused ? 28 : 26}
                  color={color}
                />
              ),
            }}
          />

          <Tabs.Screen
            name="pedido"
            options={{
              title: 'Pedido',
              tabBarIcon: ({ color, focused }) => (
                <MaterialIcons
                  name="add-shopping-cart"
                  size={focused ? 28 : 26}
                  color={color}
                />
              ),
            }}
          />

          <Tabs.Screen
            name="final"
            options={{
              title: 'Final',
              tabBarIcon: ({ color, focused }) => (
                <MaterialCommunityIcons
                  name="check-all"
                  size={focused ? 28 : 26}
                  color={color}
                />
              ),
            }}
          />

          {/* ---- TAB ESPECIAL QUE ABRE EL MENU ---- */}
          <Tabs.Screen
            name="menu"
            options={{
              title: 'Menú',
              tabBarIcon: ({ color, focused }) => (
                <Feather name="menu" size={focused ? 30 : 28} color={color} />
              ),
            }}
            listeners={{
              tabPress: (e: any) => {
                e.preventDefault();
                openDrawer();
              },
            }}
          />

          {/* ---- TABS OCULTOS PERO NAVEGABLES ---- */}
          <Tabs.Screen name="history" options={{ href: null }} />
          <Tabs.Screen name="area2area" options={{ href: null }} />
          <Tabs.Screen name="pending" options={{ href: null }} />
          <Tabs.Screen name="ajustes" options={{ href: null }} />

        </Tabs>
      </SafeAreaView>
    </ThemeProvider>
  );
}
