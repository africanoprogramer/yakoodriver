import { auth, db } from "@/config/firebase";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface VerificationStatus {
  documents: string;
  personalInfo: string;
  vehicle: string;
}

export default function DriverLoginScreen() {
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * Verificar el estado de verificación del conductor
   */
  const checkDriverVerification = async (userId: string) => {
    try {
      // Obtener documento del conductor
      const driverRef = doc(db, "drivers", userId);
      const driverSnap = await getDoc(driverRef);

      if (!driverSnap.exists()) {
        console.log("❌ No existe documento de conductor");
        Alert.alert("Error", "No se encontró información del conductor");
        return;
      }

      const driverData = driverSnap.data();
      const verificationStatus: VerificationStatus =
        driverData.verificationStatus || {};

      // Verificar si está completamente verificado
      const isFullyVerified =
        driverData.isVerified === true &&
        verificationStatus.documents === "verified" &&
        verificationStatus.personalInfo === "verified" &&
        verificationStatus.vehicle === "verified";

      if (isFullyVerified) {
        // Conductor verificado - ir al home
        console.log("✅ Conductor completamente verificado. Ir al home");
        router.replace("/(tabs)");
      } else {
        // Conductor NO verificado - mostrar pantalla de espera
        console.log("⚠️ Conductor no completamente verificado");
        router.replace({
          pathname: "/(auth)/verification-pending",
          params: {
            userId,
            fullName: driverData.fullName || "Conductor",
            email: driverData.email || "",
            phone: driverData.phone || "",
            personalInfo: verificationStatus.personalInfo || "pending",
            vehicle: verificationStatus.vehicle || "pending",
            documents: verificationStatus.documents || "pending",
          },
        });
      }
    } catch (error) {
      console.error("❌ Error verificando conductor:", error);
      Alert.alert(
        "Error",
        "Error al verificar el estado. Por favor intenta de nuevo.",
      );
    }
  };

  const handleLogin = async () => {
    try {
      if (!emailOrPhone || !password) {
        Alert.alert("Error", "Por favor completa todos los campos");
        return;
      }

      setLoading(true);

      // Intentar login con email
      const email = emailOrPhone.includes("@")
        ? emailOrPhone
        : emailOrPhone + "@yakoo.gq";

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );

      const userId = userCredential.user.uid;
      console.log("✅ Conductor logueado:", userId);

      // Verificar estado del conductor
      await checkDriverVerification(userId);

      // Limpiar campos
      setEmailOrPhone("");
      setPassword("");
    } catch (error: any) {
      console.error("❌ Error en login:", error);

      let errorMessage = "Error al iniciar sesión";

      if (error.code === "auth/user-not-found") {
        errorMessage = "Usuario no encontrado";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Contraseña incorrecta";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Email inválido";
      } else if (error.code === "auth/user-disabled") {
        errorMessage = "Esta cuenta ha sido deshabilitada";
      }

      Alert.alert("Error de Autenticación", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!emailOrPhone) {
      Alert.alert("Error", "Por favor ingresa tu email o teléfono");
      return;
    }
    router.push({
      pathname: "/(auth)/forgot-password",
      params: { email: emailOrPhone },
    });
  };

  const handleRegister = () => {
    router.push("/(auth)/onboarding");
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Yakoo Driver</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBadge}>
              <Ionicons name="car" size={60} color="#fff" />
            </View>
          </View>

          {/* Welcome Text */}
          <Text style={styles.welcomeTitle}>¡Bienvenido de vuelta!</Text>
          <Text style={styles.welcomeSubtitle}>
            ¿Listo para ponerse en camino?
          </Text>

          {/* Email or Phone Input */}
          <View style={styles.formContainer}>
            <Text style={styles.label}>Email o Teléfono</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#6B7280" />
              <TextInput
                style={styles.input}
                placeholder="Ingresa tu email o teléfono"
                placeholderTextColor="#6B7280"
                keyboardType="email-address"
                autoCapitalize="none"
                value={emailOrPhone}
                onChangeText={setEmailOrPhone}
                editable={!loading}
              />
            </View>

            {/* Password Input */}
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
              <TextInput
                style={styles.input}
                placeholder="Ingresa tu contraseña"
                placeholderTextColor="#6B7280"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={loading}
              style={styles.forgotPasswordButton}
            >
              <Text style={styles.forgotPasswordText}>
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#1F2937" size="large" />
            ) : (
              <Text style={styles.loginButtonText}>Inicia Sesión</Text>
            )}
          </TouchableOpacity>

          {/* Face ID Section */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>O</Text>
            <View style={styles.divider} />
          </View>

          {/* Face ID Button */}
          <TouchableOpacity
            style={styles.faceIdButton}
            onPress={() => Alert.alert("Info", "Face ID no disponible aún")}
          >
            <Ionicons name="eye" size={28} color="#FF6B35" />
          </TouchableOpacity>
          <Text style={styles.faceIdText}>Inicia sesión con Face ID</Text>

          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>¿Nuevo aquí? </Text>
            <TouchableOpacity onPress={handleRegister} disabled={loading}>
              <Text style={styles.registerLink}>Regístrate como conductor</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF6B35",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 20,
  },
  logoBadge: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 32,
  },
  formContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    backgroundColor: "#2D2420",
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#fff",
  },
  eyeIcon: {
    padding: 8,
    marginRight: -8,
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginTop: -8,
    marginBottom: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B35",
  },
  loginButton: {
    paddingVertical: 16,
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#374151",
  },
  dividerText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  faceIdButton: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#2D2420",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#374151",
    marginBottom: 12,
  },
  faceIdText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 32,
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    paddingBottom: 20,
  },
  registerText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  registerLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FF6B35",
  },
});
