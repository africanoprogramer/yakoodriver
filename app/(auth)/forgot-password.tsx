import { auth } from "@/config/firebase";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import React, { useState } from "react";
import {
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Animación del icono de éxito
  const [scaleAnim] = useState(new Animated.Value(0));

  const handleReset = async () => {
    Keyboard.dismiss();
    setErrorMsg("");

    // Validar email
    if (!email.trim()) {
      setErrorMsg("Ingresa tu correo electrónico");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg("El correo electrónico no es válido");
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());

      setSent(true);
      setLoading(false);

      // Animación de éxito
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }).start();
    } catch (error: any) {
      setLoading(false);
      console.error("Error enviando reset:", error);

      switch (error.code) {
        case "auth/user-not-found":
          setErrorMsg("No existe una cuenta con este correo");
          break;
        case "auth/invalid-email":
          setErrorMsg("El correo electrónico no es válido");
          break;
        case "auth/too-many-requests":
          setErrorMsg("Demasiados intentos. Espera unos minutos");
          break;
        default:
          setErrorMsg("Error enviando el correo. Intenta de nuevo");
      }
    }
  };

  const handleResend = () => {
    setSent(false);
    scaleAnim.setValue(0);
    handleReset();
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={s.content}>
            {/* Header */}
            <View style={s.header}>
              <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {!sent ? (
              /* ══════ FORMULARIO ══════ */
              <View style={s.formContainer}>
                {/* Icono */}
                <View style={s.iconCircle}>
                  <Ionicons name="lock-closed" size={36} color="#FF6B35" />
                </View>

                <Text style={s.title}>¿Olvidaste tu contraseña?</Text>
                <Text style={s.subtitle}>
                  No te preocupes. Ingresa tu correo electrónico y te enviaremos
                  un enlace para restablecer tu contraseña.
                </Text>

                {/* Input email */}
                <View style={s.inputContainer}>
                  <View style={s.inputIconWrap}>
                    <Ionicons name="mail" size={20} color="#9CA3AF" />
                  </View>
                  <TextInput
                    style={s.input}
                    placeholder="correo@ejemplo.com"
                    placeholderTextColor="#6B7280"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setErrorMsg("");
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    editable={!loading}
                  />
                </View>

                {/* Error */}
                {errorMsg ? (
                  <View style={s.errorBox}>
                    <Ionicons name="alert-circle" size={16} color="#EF4444" />
                    <Text style={s.errorText}>{errorMsg}</Text>
                  </View>
                ) : null}

                {/* Botón enviar */}
                <TouchableOpacity
                  style={[s.sendBtn, loading && s.sendBtnDisabled]}
                  onPress={handleReset}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <Text style={s.sendBtnText}>Enviando...</Text>
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#fff" />
                      <Text style={s.sendBtnText}>
                        Enviar enlace de recuperación
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Volver al login */}
                <TouchableOpacity
                  style={s.backToLogin}
                  onPress={() => router.back()}
                >
                  <Ionicons name="arrow-back" size={16} color="#FF6B35" />
                  <Text style={s.backToLoginText}>
                    Volver al inicio de sesión
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ══════ ÉXITO ══════ */
              <View style={s.successContainer}>
                <Animated.View
                  style={[
                    s.successCircle,
                    { transform: [{ scale: scaleAnim }] },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                </Animated.View>

                <Text style={s.successTitle}>¡Correo enviado!</Text>
                <Text style={s.successSubtitle}>
                  Hemos enviado un enlace de recuperación a:
                </Text>
                <Text style={s.successEmail}>{email}</Text>
                <Text style={s.successHint}>
                  Revisa tu bandeja de entrada y haz clic en el enlace para
                  restablecer tu contraseña. Si no lo ves, revisa la carpeta de
                  spam.
                </Text>

                {/* Botones */}
                <TouchableOpacity
                  style={s.openMailBtn}
                  onPress={() => router.back()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="log-in" size={18} color="#fff" />
                  <Text style={s.openMailBtnText}>
                    Volver al inicio de sesión
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.resendBtn} onPress={handleResend}>
                  <Ionicons name="refresh" size={16} color="#FF6B35" />
                  <Text style={s.resendBtnText}>Reenviar correo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  content: { flex: 1, paddingHorizontal: 24 },

  // Header
  header: { paddingVertical: 12 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
  },

  // Form
  formContainer: { flex: 1, justifyContent: "center", paddingBottom: 60 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#FF6B35",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 12,
  },

  // Input
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#374151",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  inputIconWrap: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
    paddingVertical: 16,
  },

  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1C1017",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#EF4444",
  },
  errorText: { fontSize: 13, color: "#FCA5A5", fontWeight: "500", flex: 1 },

  // Send button
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FF6B35",
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 20,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },

  // Back to login
  backToLogin: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  backToLoginText: { fontSize: 14, fontWeight: "600", color: "#FF6B35" },

  // Success
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 60,
  },
  successCircle: { marginBottom: 24 },
  successTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 15,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 8,
  },
  successEmail: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FF6B35",
    marginBottom: 20,
  },
  successHint: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  openMailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FF6B35",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 16,
    width: "100%",
  },
  openMailBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  resendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  resendBtnText: { fontSize: 14, fontWeight: "600", color: "#FF6B35" },
});
