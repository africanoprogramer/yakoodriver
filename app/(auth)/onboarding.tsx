import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const ONBOARDING_STEPS = [
  {
    id: 1,
    title: "Gana dinero a tu ritmo",
    subtitle: "Eres tu propio jefe",
    description:
      "Tú decides cuándo y cuánto quieres trabajar. Sin jefes, sin horarios fijos. El control es tuyo.",
    image: require("@/assets/images/driver/onboarding-1.png"),
    icon: "🚗",
    stats: {
      amount: "$124.50",
      percentage: "+12%",
      label: "GANANCIAS DE HOY",
    },
  },
  {
    id: 2,
    title: "Encuentra viajes fácilmente",
    subtitle: "Zona centro: +200 XAF extra",
    description:
      "Nuestra tecnología te guía hacia las zonas con más pedidos para que nunca dejes de ganar.",
    image: require("@/assets/images/driver/onboarding-2.png"),
    icon: "📍",
    hasMap: true,
  },
  {
    id: 3,
    title: "Seguridad y pagos rápidos",
    subtitle: "Retiros inmediatos",
    description:
      "Viajes monitoreados 24/7 y retiros de tus ganancias de forma inmediata a tu banco.",
    image: require("@/assets/images/driver/onboarding-3.png"),
    icon: "🔒",
    hasCheckmark: true,
  },
];

export default function DriverOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const step = ONBOARDING_STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      router.push("/(auth)/register");
    }
  };

  const handleSkip = () => {
    router.push("/(auth)/login");
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yakoo Driver</Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipButton}>Omitir</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        {/* Imagen Principal con Overlay */}
        <View style={styles.imageContainer}>
          <Image
            source={step.image}
            style={styles.mainImage}
            resizeMode="cover"
          />

          {/* Overlay Oscuro */}
          <View style={styles.imageOverlay} />

          {/* Stats Card (Solo en paso 1) */}
          {step.stats && (
            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>{step.stats.label}</Text>
              <View style={styles.statsRow}>
                <Text style={styles.statsAmount}>{step.stats.amount}</Text>
                <Text style={styles.statsPercentage}>
                  {step.stats.percentage}
                </Text>
              </View>
            </View>
          )}

          {/* Map Indicator (Solo en paso 2) */}
          {step.hasMap && (
            <View style={styles.mapContainer}>
              <View style={styles.demandBadge}>
                <Ionicons name="flame" size={16} color="#FF6B35" />
                <Text style={styles.demandText}>ALTA DEMANDA</Text>
              </View>
              <Text style={styles.demandExtra}>Zona centro: +$2.50 extra</Text>
            </View>
          )}

          {/* Checkmark Circle (Solo en paso 3) */}
          {step.hasCheckmark && (
            <View style={styles.checkmarkContainer}>
              <View style={styles.checkmarkCircle}>
                <Ionicons name="checkmark" size={40} color="#10B981" />
              </View>
            </View>
          )}
        </View>

        {/* Contenido */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.subtitle}>{step.subtitle}</Text>
          <Text style={styles.description}>{step.description}</Text>
        </View>

        {/* Indicadores de progreso */}
        <View style={styles.dotsContainer}>
          {ONBOARDING_STEPS.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === currentStep && styles.dotActive]}
            />
          ))}
        </View>
      </ScrollView>

      {/* Botón de acción */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {currentStep === ONBOARDING_STEPS.length - 1
              ? "Empezar ahora"
              : "Siguiente"}
          </Text>
          {currentStep < ONBOARDING_STEPS.length - 1 && (
            <Ionicons name="arrow-forward" size={20} color="#1F2937" />
          )}
        </TouchableOpacity>

        {/* Terms and Conditions */}
        {currentStep === ONBOARDING_STEPS.length - 1 && (
          <Text style={styles.termsText}>
            Al continuar, aceptas nuestros Términos y Condiciones
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1F2937",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#0F1419",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FF6B35",
    letterSpacing: 0.5,
  },
  skipButton: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B35",
  },
  scrollContainer: {
    flex: 1,
  },
  imageContainer: {
    width: width,
    height: height * 0.5,
    position: "relative",
    overflow: "hidden",
  },
  mainImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  statsCard: {
    position: "absolute",
    top: 40,
    left: "50%",
    transform: [{ translateX: -70 }],
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backdropFilter: "blur(10px)",
  },
  statsLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statsAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  statsPercentage: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10B981",
  },
  mapContainer: {
    position: "absolute",
    top: 30,
    right: 20,
    alignItems: "flex-end",
    gap: 8,
  },
  demandBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  demandText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 0.3,
  },
  demandExtra: {
    fontSize: 12,
    fontWeight: "500",
    color: "#fff",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  checkmarkContainer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    zIndex: 10,
  },
  checkmarkCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF6B35",
    marginBottom: 16,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#9CA3AF",
    lineHeight: 22,
    textAlign: "center",
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4B5563",
  },
  dotActive: {
    backgroundColor: "#FF6B35",
    width: 28,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  termsText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
});
