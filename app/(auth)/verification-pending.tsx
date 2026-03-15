import { auth } from "@/config/firebase";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { signOut } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PendingVerificationScreen() {
  const params = useLocalSearchParams();
  const [spinValue] = useState(new Animated.Value(0));

  const fullName = (params.fullName as string) || "Conductor";
  const personalInfo = (params.personalInfo as string) || "pending";
  const vehicle = (params.vehicle as string) || "pending";
  const documents = (params.documents as string) || "pending";
  const phone = (params.phone as string) || "";

  // Animación de rotación
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const verificationSteps = [
    {
      id: 1,
      title: "Información Personal",
      status: personalInfo,
      description: "Datos personales y documentos de identidad",
      icon: "person",
    },
    {
      id: 2,
      title: "Información del Vehículo",
      status: vehicle,
      description: "Detalles y documentación del vehículo",
      icon: "car",
    },
    {
      id: 3,
      title: "Documentos",
      status: documents,
      description: "Licencia, seguro y antecedentes",
      icon: "document",
    },
  ];

  const allPending = verificationSteps.every(
    (step) => step.status === "pending",
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "#10B981";
      case "rejected":
        return "#EF4444";
      default:
        return "#FF9800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "verified":
        return "Verificado";
      case "rejected":
        return "Rechazado";
      default:
        return "Pendiente";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return "checkmark";
      case "rejected":
        return "close";
      default:
        return "hourglass";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Yakoo Driver</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logoutButton}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Alert Container */}
        <View style={styles.alertContainer}>
          <View style={styles.alertIcon}>
            <Ionicons name="alert-circle" size={40} color="#fff" />
          </View>
          <Text style={styles.alertTitle}>Conductor No Verificado</Text>
          <Text style={styles.alertDescription}>
            Tu cuenta aún no ha sido completamente verificada. Por favor espera
            a que completemos la revisión de tus documentos.
          </Text>
        </View>

        {/* Animated Loading Circle */}
        <View style={styles.animationContainer}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="checkmark-circle" size={80} color="#FF6B35" />
          </Animated.View>
        </View>

        {/* Status Container */}
        <View style={styles.statusContainer}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Estado de Verificación</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: allPending ? "#FF9800" : "#FBBF24" },
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {allPending ? "En Revisión" : "Verificando"}
              </Text>
            </View>
          </View>

          {/* Verification Steps */}
          <View style={styles.stepsContainer}>
            {verificationSteps.map((step, index) => (
              <View key={step.id}>
                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepIconContainer,
                      { backgroundColor: getStatusColor(step.status) },
                    ]}
                  >
                    <Ionicons
                      name={getStatusIcon(step.status) as any}
                      size={24}
                      color="#fff"
                    />
                  </View>

                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDescription}>
                      {step.description}
                    </Text>
                  </View>

                  <View style={styles.stepStatus}>
                    <Text
                      style={[
                        styles.stepStatusText,
                        { color: getStatusColor(step.status) },
                      ]}
                    >
                      {getStatusText(step.status)}
                    </Text>
                  </View>
                </View>

                {index < verificationSteps.length - 1 && (
                  <View style={styles.stepDivider} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <Ionicons name="information-circle" size={20} color="#FF6B35" />
            <Text style={styles.infoText}>
              El proceso de verificación toma 24-48 horas
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="notifications" size={20} color="#FF6B35" />
            <Text style={styles.infoText}>
              Recibirás una notificación SMS cuando sea aprobado
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={20} color="#FF6B35" />
            <Text style={styles.infoText}>
              Una vez verificado, podrás comenzar a ganar inmediatamente
            </Text>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.faqContainer}>
          <Text style={styles.faqTitle}>Preguntas Frecuentes</Text>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>
              ¿Por qué mi cuenta no está verificada?
            </Text>
            <Text style={styles.faqAnswer}>
              Es probable que aún estemos revisando tus documentos. El proceso
              toma 24-48 horas.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>¿Qué pasa si es rechazada?</Text>
            <Text style={styles.faqAnswer}>
              Te contactaremos con los detalles. Podrás resubmitir los
              documentos.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>
              ¿Puedo trabajar mientras espero?
            </Text>
            <Text style={styles.faqAnswer}>
              No, necesitas estar verificado para aceptar viajes.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.supportButton} onPress={() => {}}>
          <Ionicons name="help-circle" size={20} color="#FF6B35" />
          <Text style={styles.supportButtonText}>Contactar Soporte</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButtonBottom}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonTextBottom}>Volver a Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1F2937",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF6B35",
  },
  logoutButton: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B35",
  },
  alertContainer: {
    backgroundColor: "#D97706",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: "center",
  },
  alertIcon: {
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  alertDescription: {
    fontSize: 14,
    color: "#fff",
    lineHeight: 22,
    textAlign: "center",
    opacity: 0.9,
  },
  animationContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 120,
    marginBottom: 24,
  },
  statusContainer: {
    backgroundColor: "#2D2420",
    borderWidth: 1,
    borderColor: "#5F4D3E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1F2937",
  },
  stepsContainer: {
    gap: 0,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  stepIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  stepStatus: {
    marginTop: 2,
  },
  stepStatusText: {
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#FFF3E0",
  },
  stepDivider: {
    height: 1,
    backgroundColor: "#374151",
    marginLeft: 22,
  },
  infoContainer: {
    gap: 12,
    marginBottom: 24,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#2D2420",
    borderLeftWidth: 3,
    borderLeftColor: "#FF6B35",
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#9CA3AF",
    lineHeight: 20,
  },
  faqContainer: {
    backgroundColor: "#2D2420",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#5F4D3E",
  },
  faqTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  faqItem: {
    marginBottom: 12,
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FF6B35",
    marginBottom: 4,
  },
  faqAnswer: {
    fontSize: 12,
    color: "#9CA3AF",
    lineHeight: 18,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#374151",
    backgroundColor: "#111827",
    gap: 12,
  },
  supportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#5F4D3E",
    borderRadius: 12,
    gap: 8,
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FF6B35",
  },
  logoutButtonBottom: {
    paddingVertical: 14,
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutButtonTextBottom: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
});
