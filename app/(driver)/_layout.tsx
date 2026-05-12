import { Stack } from "expo-router";

export default function DriverLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="driver-trip-in-progress" />
      <Stack.Screen name="supermarket-orders" />
      <Stack.Screen name="restaurant-orders" />
      <Stack.Screen name="reservations" />
    </Stack>
  );
}
