import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, useWindowDimensions } from 'react-native';
import 'react-native-reanimated';
import "../../global.css";
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider, useAppTheme } from '@/providers/ThemeProvider'; // ✅ Hook personalizado
import WifiBanner from '@/components/WifiBanner';

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme(); // ✅ Obtiene el tema actual desde el provider
  const isDark = theme === 'dark';
  const isSmallDevice = width < 360;

  // Colores dinámicos por tema
  const activeColor = isDark ? '#60A5FA' : '#2563EB';
  const inactiveColor = isDark ? '#9CA3AF' : '#94A3B8';
  const backgroundColor = isDark ? '#1F2937' : '#F9FAFB';

  return (
    <ThemeProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor }}>
        {/* <WifiBanner/> */}
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
            name="history"
            options={{
              title: 'Entradas',
              tabBarIcon: ({ color, focused }) => (
                <Feather
                  name="arrow-right-circle"
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
          
          <Tabs.Screen
            name="ajustes"
            options={{
              title: 'Ajustes',
              tabBarIcon: ({ color, focused }) => (
                <Feather
                  name="settings"
                  size={focused ? 28 : 26}
                  color={color}
                />
              ),
            }}
          />
        </Tabs>
      </SafeAreaView>
    </ThemeProvider>

  );
}
