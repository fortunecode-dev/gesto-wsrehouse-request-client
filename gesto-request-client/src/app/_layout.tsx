import { Slot } from 'expo-router';
import { ThemeProvider } from '@/providers/ThemeProvider'; // ajusta la ruta si es necesario

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Slot />
    </ThemeProvider>
  );
}
