import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
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

import { auth, db, storage } from "@/config/firebase";
import {
  pickImageWithPermission,
  takePhotoWithPermission,
} from "@/utils/permissions";

const { width } = Dimensions.get("window");

const VEHICLE_BRANDS = [
  "Toyota",
  "Honda",
  "Hyundai",
  "Kia",
  "BMW",
  "Mercedes-Benz",
  "Volkswagen",
  "Ford",
  "Chevrolet",
  "Nissan",
  "Suzuki",
  "Yamaha",
  "Bajaj",
  "Hero",
  "TVS",
];
const VEHICLE_COLORS = [
  "Blanco",
  "Negro",
  "Gris",
  "Rojo",
  "Azul",
  "Verde",
  "Plateado",
  "Dorado",
  "Naranja",
];
const YEARS = Array.from({ length: 20 }, (_, i) => 2024 - i).map(String);

type VehicleType = "car" | "moto" | null;

interface Step1Data {
  fullName: string;
  identificationNumber: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  profilePhoto: string | null;
}
interface Step2Data {
  vehicleType: VehicleType;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleYear: string;
  licensePlate: string;
}
interface Step3Data {
  licenseFront: string | null;
  licenseBack: string | null;
  vehicleInsurance: string | null;
  criminalRecord: string | null;
}
interface Step4Data {
  passportPhoto: string | null;
  dipDocument: string | null;
}

// ── Sub-components ─────────────────────────────────────────────

const StepHeader = ({ current, total }: { current: number; total: number }) => (
  <View style={s.stepHeader}>
    <View style={s.stepsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <View
            style={[
              s.stepDot,
              i < current && s.stepDotDone,
              i === current - 1 && s.stepDotActive,
            ]}
          >
            {i < current - 1 ? (
              <Ionicons name="checkmark" size={10} color="#fff" />
            ) : (
              <Text style={s.stepDotTxt}>{i + 1}</Text>
            )}
          </View>
          {i < total - 1 && (
            <View style={[s.stepLine, i < current - 1 && s.stepLineDone]} />
          )}
        </React.Fragment>
      ))}
    </View>
    <Text style={s.stepCount}>
      Paso {current} de {total}
    </Text>
  </View>
);

const Field = ({
  label,
  placeholder,
  value,
  onChangeText,
  secure,
  keyboard,
  autoCapitalize,
}: any) => (
  <View style={s.field}>
    <Text style={s.fieldLabel}>{label}</Text>
    <TextInput
      style={s.fieldInput}
      placeholder={placeholder}
      placeholderTextColor="#6B7280"
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secure}
      keyboardType={keyboard ?? "default"}
      autoCapitalize={autoCapitalize ?? "sentences"}
    />
  </View>
);

const Picker = ({
  label,
  value,
  placeholder,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onSelect: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TouchableOpacity style={s.pickerBtn} onPress={() => setOpen(!open)}>
        <Text style={[s.pickerBtnTxt, !value && { color: "#6B7280" }]}>
          {value || placeholder}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color="#F2AB30"
        />
      </TouchableOpacity>
      {open && (
        <View style={s.pickerDropdown}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={s.pickerOpt}
                onPress={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
              >
                <Text style={s.pickerOptTxt}>{opt}</Text>
                {value === opt && (
                  <Ionicons name="checkmark" size={16} color="#F2AB30" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const DocUpload = ({
  label,
  subtitle,
  value,
  onCamera,
  onGallery,
}: {
  label: string;
  subtitle?: string;
  value: string | null;
  onCamera: () => void;
  onGallery: () => void;
}) => (
  <View style={s.docWrap}>
    <View style={s.docHeader}>
      <Ionicons
        name={value ? "checkmark-circle" : "document-outline"}
        size={20}
        color={value ? "#10B981" : "#9CA3AF"}
      />
      <View style={{ flex: 1 }}>
        <Text style={s.docLabel}>{label}</Text>
        {subtitle && <Text style={s.docSub}>{subtitle}</Text>}
      </View>
      {value && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
    </View>
    {value ? (
      <View style={s.docPreview}>
        <Image source={{ uri: value }} style={s.docImg} resizeMode="cover" />
        <TouchableOpacity style={s.docChange} onPress={onGallery}>
          <Ionicons name="refresh" size={14} color="#F2AB30" />
          <Text style={s.docChangeTxt}>Cambiar</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <View style={s.docActions}>
        <TouchableOpacity style={s.docBtn} onPress={onCamera}>
          <Ionicons name="camera" size={16} color="#fff" />
          <Text style={s.docBtnTxt}>Cámara</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.docBtn, s.docBtnOutline]}
          onPress={onGallery}
        >
          <Ionicons name="image" size={16} color="#F2AB30" />
          <Text style={[s.docBtnTxt, { color: "#F2AB30" }]}>Galería</Text>
        </TouchableOpacity>
      </View>
    )}
  </View>
);

// ── Main Component ──────────────────────────────────────────────

export default function DriverRegisterScreen() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [step1, setStep1] = useState<Step1Data>({
    fullName: "",
    identificationNumber: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    profilePhoto: null,
  });
  const [step2, setStep2] = useState<Step2Data>({
    vehicleType: null,
    vehicleBrand: "",
    vehicleModel: "",
    vehicleColor: "",
    vehicleYear: "",
    licensePlate: "",
  });
  const [step3, setStep3] = useState<Step3Data>({
    licenseFront: null,
    licenseBack: null,
    vehicleInsurance: null,
    criminalRecord: null,
  });
  const [step4, setStep4] = useState<Step4Data>({
    passportPhoto: null,
    dipDocument: null,
  });

  // ── Image helpers ──
  const pick = async (setter: any, field: string) =>
    pickImageWithPermission(setter, field);
  const camera = async (setter: any, field: string) =>
    takePhotoWithPermission(setter, field);

  const uploadImage = async (
    uri: string,
    path: string,
  ): Promise<string | null> => {
    try {
      const blob = await (await fetch(uri)).blob();
      const r = ref(storage, path);
      await uploadBytes(r, blob);
      return await getDownloadURL(r);
    } catch {
      return null;
    }
  };

  // ── Validations ──
  const validate1 = () => {
    const {
      fullName,
      identificationNumber,
      phone,
      email,
      password,
      confirmPassword,
    } = step1;
    if (
      !fullName ||
      !identificationNumber ||
      !phone ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert(
        "Campos incompletos",
        "Por favor completa todos los campos obligatorios.",
      );
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Las contraseñas no coinciden.");
      return false;
    }
    if (password.length < 6) {
      Alert.alert("Error", "La contraseña debe tener al menos 6 caracteres.");
      return false;
    }
    return true;
  };
  const validate2 = () => {
    const {
      vehicleType,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      vehicleYear,
      licensePlate,
    } = step2;
    if (!vehicleType) {
      Alert.alert("Tipo de vehículo", "Selecciona si conduces coche o moto.");
      return false;
    }
    if (
      !vehicleBrand ||
      !vehicleModel ||
      !vehicleColor ||
      !vehicleYear ||
      !licensePlate
    ) {
      Alert.alert(
        "Campos incompletos",
        "Completa todos los datos del vehículo.",
      );
      return false;
    }
    return true;
  };
  const validate3 = () => {
    if (!step3.licenseFront || !step3.licenseBack) {
      Alert.alert("Licencia", "Sube ambos lados de tu licencia de conducir.");
      return false;
    }
    if (!step3.vehicleInsurance) {
      Alert.alert("Seguro", "Sube la póliza de seguro del vehículo.");
      return false;
    }
    return true;
  };
  const validate4 = () => {
    if (!step4.passportPhoto || !step4.dipDocument) {
      Alert.alert("Documentos", "Sube tu pasaporte y el documento DIP.");
      return false;
    }
    return true;
  };

  const handleNext = async () => {
    if (step === 1 && validate1()) setStep(2);
    else if (step === 2 && validate2()) setStep(3);
    else if (step === 3 && validate3()) setStep(4);
    else if (step === 4 && validate4()) await handleRegister();
  };

  const handleRegister = async () => {
    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(
        auth,
        step1.email,
        step1.password,
      );
      const uid = cred.user.uid;

      const [
        profileUrl,
        licenseFrontUrl,
        licenseBackUrl,
        insuranceUrl,
        passportUrl,
        dipUrl,
        criminalUrl,
      ] = await Promise.all([
        step1.profilePhoto
          ? uploadImage(step1.profilePhoto, `drivers/${uid}/profile.jpg`)
          : Promise.resolve(null),
        uploadImage(step3.licenseFront!, `drivers/${uid}/license_front.jpg`),
        uploadImage(step3.licenseBack!, `drivers/${uid}/license_back.jpg`),
        uploadImage(step3.vehicleInsurance!, `drivers/${uid}/insurance.jpg`),
        uploadImage(step4.passportPhoto!, `drivers/${uid}/passport.jpg`),
        uploadImage(step4.dipDocument!, `drivers/${uid}/dip.jpg`),
        step3.criminalRecord
          ? uploadImage(
              step3.criminalRecord,
              `drivers/${uid}/criminal_record.jpg`,
            )
          : Promise.resolve(null),
      ]);

      await setDoc(doc(db, "drivers", uid), {
        userId: uid,
        fullName: step1.fullName,
        email: step1.email,
        phone: step1.phone,
        identificationNumber: step1.identificationNumber,
        profilePicture: profileUrl,
        rating: 5.0,
        totalTrips: 0,
        totalEarnings: 0,
        balance: 0,
        isOnline: false,
        isAvailable: false,
        isVerified: false,
        createdAt: new Date(),
        vehicle: {
          type: step2.vehicleType, // ← "car" | "moto"
          brand: step2.vehicleBrand,
          model: step2.vehicleModel,
          color: step2.vehicleColor,
          year: step2.vehicleYear,
          licensePlate: step2.licensePlate,
          image: null,
          verification: "pending",
        },
        documents: {
          licenseFront: licenseFrontUrl,
          licenseBack: licenseBackUrl,
          vehicleInsurance: insuranceUrl,
          passport: passportUrl,
          dip: dipUrl,
          criminalRecord: criminalUrl,
          verification: "pending",
        },
        status: "pending",
        verificationStatus: {
          personalInfo: "pending",
          vehicle: "pending",
          documents: "pending",
        },
      });

      router.push({
        pathname: "/(auth)/verification-pending",
        params: { driverId: uid, phone: step1.phone },
      });
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.message || "Error al registrar. Intenta de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.headerBack}
            onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Registro de Conductor</Text>
            <Text style={s.headerSub}>
              {step === 1 && "Información personal"}
              {step === 2 && "Datos del vehículo"}
              {step === 3 && "Documentos de conducción"}
              {step === 4 && "Documentos de identidad"}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
            <Text style={s.headerHelp}>Ayuda</Text>
          </TouchableOpacity>
        </View>

        {/* Step indicator */}
        <StepHeader current={step} total={4} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* ── STEP 1: Personal Info + Foto ── */}
          {step === 1 && (
            <View style={s.stepBody}>
              <Text style={s.stepTitle}>Información Personal</Text>
              <Text style={s.stepDesc}>
                Rellena tus datos para crear tu cuenta de conductor.
              </Text>

              {/* Foto de perfil */}
              <View style={s.avatarSection}>
                <TouchableOpacity
                  style={s.avatarWrap}
                  onPress={() => camera(setStep1, "profilePhoto")}
                >
                  {step1.profilePhoto ? (
                    <Image
                      source={{ uri: step1.profilePhoto }}
                      style={s.avatar}
                    />
                  ) : (
                    <View style={s.avatarEmpty}>
                      <Ionicons name="person" size={36} color="#6B7280" />
                    </View>
                  )}
                  <View style={s.avatarBadge}>
                    <Ionicons name="camera" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
                <View>
                  <Text style={s.avatarLabel}>Foto de perfil</Text>
                  <Text style={s.avatarSub}>
                    Opcional — visible para los pasajeros
                  </Text>
                  {!step1.profilePhoto && (
                    <TouchableOpacity
                      onPress={() => pick(setStep1, "profilePhoto")}
                    >
                      <Text style={s.avatarLink}>Subir desde galería</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <Field
                label="Nombre completo *"
                placeholder="Tu nombre completo"
                value={step1.fullName}
                onChangeText={(t: string) =>
                  setStep1({ ...step1, fullName: t })
                }
              />
              <Field
                label="Nº de identificación / Pasaporte *"
                placeholder="ID, Pasaporte o DNI"
                value={step1.identificationNumber}
                onChangeText={(t: string) =>
                  setStep1({ ...step1, identificationNumber: t })
                }
                autoCapitalize="characters"
              />
              <Field
                label="Teléfono *"
                placeholder="+240 222 000 000"
                value={step1.phone}
                onChangeText={(t: string) => setStep1({ ...step1, phone: t })}
                keyboard="phone-pad"
              />
              <Field
                label="Email *"
                placeholder="tu@email.com"
                value={step1.email}
                onChangeText={(t: string) => setStep1({ ...step1, email: t })}
                keyboard="email-address"
                autoCapitalize="none"
              />
              <Field
                label="Contraseña *"
                placeholder="Mínimo 6 caracteres"
                value={step1.password}
                onChangeText={(t: string) =>
                  setStep1({ ...step1, password: t })
                }
                secure
              />
              <Field
                label="Confirmar contraseña *"
                placeholder="Repite la contraseña"
                value={step1.confirmPassword}
                onChangeText={(t: string) =>
                  setStep1({ ...step1, confirmPassword: t })
                }
                secure
              />
            </View>
          )}

          {/* ── STEP 2: Vehículo ── */}
          {step === 2 && (
            <View style={s.stepBody}>
              <Text style={s.stepTitle}>Tu Vehículo</Text>
              <Text style={s.stepDesc}>
                Selecciona el tipo de vehículo con el que prestarás servicio.
              </Text>

              {/* Tipo de vehículo */}
              <Text style={s.fieldLabel}>Tipo de vehículo *</Text>
              <View style={s.vehicleTypeRow}>
                <TouchableOpacity
                  style={[
                    s.vehicleTypeCard,
                    step2.vehicleType === "car" && s.vehicleTypeCardActive,
                  ]}
                  onPress={() => setStep2({ ...step2, vehicleType: "car" })}
                >
                  <Text style={s.vehicleTypeEmoji}>🚗</Text>
                  <Text
                    style={[
                      s.vehicleTypeName,
                      step2.vehicleType === "car" && s.vehicleTypeNameActive,
                    ]}
                  >
                    Coche
                  </Text>
                  <Text style={s.vehicleTypeDesc}>Transporte de pasajeros</Text>
                  {step2.vehicleType === "car" && (
                    <View style={s.vehicleTypeCheck}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    s.vehicleTypeCard,
                    step2.vehicleType === "moto" && s.vehicleTypeCardActive,
                  ]}
                  onPress={() => setStep2({ ...step2, vehicleType: "moto" })}
                >
                  <Text style={s.vehicleTypeEmoji}>🏍️</Text>
                  <Text
                    style={[
                      s.vehicleTypeName,
                      step2.vehicleType === "moto" && s.vehicleTypeNameActive,
                    ]}
                  >
                    Moto
                  </Text>
                  <Text style={s.vehicleTypeDesc}>Delivery y repartos</Text>
                  {step2.vehicleType === "moto" && (
                    <View style={s.vehicleTypeCheck}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {step2.vehicleType && (
                <>
                  <Picker
                    label="Marca *"
                    value={step2.vehicleBrand}
                    placeholder="Selecciona la marca"
                    options={VEHICLE_BRANDS}
                    onSelect={(v) => setStep2({ ...step2, vehicleBrand: v })}
                  />
                  <Field
                    label="Modelo *"
                    placeholder={
                      step2.vehicleType === "car"
                        ? "Ej. Corolla, Civic..."
                        : "Ej. Wave, FZ, Pulsar..."
                    }
                    value={step2.vehicleModel}
                    onChangeText={(t: string) =>
                      setStep2({ ...step2, vehicleModel: t })
                    }
                  />

                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Picker
                        label="Año *"
                        value={step2.vehicleYear}
                        placeholder="2024"
                        options={YEARS}
                        onSelect={(v) => setStep2({ ...step2, vehicleYear: v })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Picker
                        label="Color *"
                        value={step2.vehicleColor}
                        placeholder="Blanco"
                        options={VEHICLE_COLORS}
                        onSelect={(v) =>
                          setStep2({ ...step2, vehicleColor: v })
                        }
                      />
                    </View>
                  </View>

                  <Field
                    label="Matrícula / Placa *"
                    placeholder="ABC-1234"
                    value={step2.licensePlate}
                    onChangeText={(t: string) =>
                      setStep2({ ...step2, licensePlate: t })
                    }
                    autoCapitalize="characters"
                  />
                </>
              )}
            </View>
          )}

          {/* ── STEP 3: Documentos conducción ── */}
          {step === 3 && (
            <View style={s.stepBody}>
              <Text style={s.stepTitle}>Documentos</Text>
              <Text style={s.stepDesc}>
                Necesitamos verificar tu licencia y el seguro del vehículo para
                activar tu cuenta.
              </Text>

              <View style={s.sectionTag}>
                <Text style={s.sectionTagTxt}>LICENCIA DE CONDUCIR</Text>
              </View>

              <DocUpload
                label="Licencia — Frente *"
                subtitle="Foto clara, sin reflejos"
                value={step3.licenseFront}
                onCamera={() => camera(setStep3, "licenseFront")}
                onGallery={() => pick(setStep3, "licenseFront")}
              />
              <DocUpload
                label="Licencia — Reverso *"
                subtitle="Mismas condiciones"
                value={step3.licenseBack}
                onCamera={() => camera(setStep3, "licenseBack")}
                onGallery={() => pick(setStep3, "licenseBack")}
              />

              <View style={[s.sectionTag, { marginTop: 8 }]}>
                <Text style={s.sectionTagTxt}>SEGURO DEL VEHÍCULO</Text>
              </View>

              <DocUpload
                label="Póliza de Seguro *"
                subtitle="PDF, JPG o PNG — máx. 10MB"
                value={step3.vehicleInsurance}
                onCamera={() => camera(setStep3, "vehicleInsurance")}
                onGallery={() => pick(setStep3, "vehicleInsurance")}
              />

              <View style={[s.sectionTag, { marginTop: 8 }]}>
                <Text style={s.sectionTagTxt}>ANTECEDENTES PENALES</Text>
              </View>

              <DocUpload
                label="Certificado de Antecedentes"
                subtitle="Emitido en los últimos 3 meses · Opcional"
                value={step3.criminalRecord}
                onCamera={() => camera(setStep3, "criminalRecord")}
                onGallery={() => pick(setStep3, "criminalRecord")}
              />
              <Text style={s.optional}>
                * Puedes añadir este documento más tarde desde tu perfil.
              </Text>
            </View>
          )}

          {/* ── STEP 4: Identidad ── */}
          {step === 4 && (
            <View style={s.stepBody}>
              <Text style={s.stepTitle}>Identidad</Text>
              <Text style={s.stepDesc}>
                El último paso. Sube tu pasaporte y el DIP para completar el
                registro.
              </Text>

              <View style={s.sectionTag}>
                <Text style={s.sectionTagTxt}>PASAPORTE</Text>
              </View>

              <DocUpload
                label="Foto del Pasaporte *"
                subtitle="Página con foto y datos personales"
                value={step4.passportPhoto}
                onCamera={() => camera(setStep4, "passportPhoto")}
                onGallery={() => pick(setStep4, "passportPhoto")}
              />

              <View style={[s.sectionTag, { marginTop: 8 }]}>
                <Text style={s.sectionTagTxt}>DOCUMENTO DIP</Text>
              </View>

              <DocUpload
                label="Documento DIP *"
                subtitle="Documento de Identidad Personal"
                value={step4.dipDocument}
                onCamera={() => camera(setStep4, "dipDocument")}
                onGallery={() => pick(setStep4, "dipDocument")}
              />

              {/* Info card */}
              <View style={s.infoCard}>
                <Ionicons name="shield-checkmark" size={22} color="#10B981" />
                <View style={{ flex: 1 }}>
                  <Text style={s.infoCardTitle}>Revisión en 24-48 horas</Text>
                  <Text style={s.infoCardDesc}>
                    Nuestro equipo revisará tus documentos. Te notificaremos por
                    WhatsApp cuando tu cuenta esté activa.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom CTA */}
        <View style={s.footer}>
          <TouchableOpacity
            style={s.ctaBtn}
            onPress={handleNext}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#1F2937" />
            ) : (
              <>
                <Text style={s.ctaBtnTxt}>
                  {step === 4 ? "Completar Registro" : "Continuar"}
                </Text>
                {step < 4 && (
                  <Ionicons name="arrow-forward" size={18} color="#1F2937" />
                )}
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={s.secondaryBtnTxt}>
              {step === 1
                ? "¿Ya tienes cuenta? Inicia sesión"
                : "Guardar y continuar después"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  headerHelp: { fontSize: 13, fontWeight: "600", color: "#F2AB30" },

  // Step indicator
  stepHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#111827",
  },
  stepsRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#374151",
  },
  stepDotActive: { backgroundColor: "#F2AB30", borderColor: "#F2AB30" },
  stepDotDone: { backgroundColor: "#10B981", borderColor: "#10B981" },
  stepDotTxt: { fontSize: 11, fontWeight: "700", color: "#6B7280" },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#374151",
    marginHorizontal: 4,
  },
  stepLineDone: { backgroundColor: "#10B981" },
  stepCount: { fontSize: 12, color: "#6B7280", fontWeight: "500" },

  // Step body
  stepBody: { paddingHorizontal: 20, paddingTop: 8 },
  stepTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 13,
    color: "#9CA3AF",
    lineHeight: 20,
    marginBottom: 24,
  },

  // Avatar
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
    backgroundColor: "#1F2937",
    padding: 16,
    borderRadius: 16,
  },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: "#F2AB30",
  },
  avatarEmpty: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#4B5563",
    borderStyle: "dashed",
  },
  avatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#F2AB30",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#1F2937",
  },
  avatarLabel: { fontSize: 14, fontWeight: "700", color: "#fff" },
  avatarSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  avatarLink: {
    fontSize: 12,
    color: "#F2AB30",
    fontWeight: "600",
    marginTop: 6,
  },

  // Fields
  field: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldInput: {
    backgroundColor: "#1F2937",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#fff",
  },

  // Picker
  pickerBtn: {
    backgroundColor: "#1F2937",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerBtnTxt: { fontSize: 15, color: "#fff", flex: 1 },
  pickerDropdown: {
    backgroundColor: "#1F2937",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 12,
    marginTop: 4,
    overflow: "hidden",
  },
  pickerOpt: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  pickerOptTxt: { fontSize: 15, color: "#fff" },

  // Row
  row: { flexDirection: "row", gap: 12 },

  // Vehicle type
  vehicleTypeRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  vehicleTypeCard: {
    flex: 1,
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#374151",
    position: "relative",
    overflow: "hidden",
  },
  vehicleTypeCardActive: { borderColor: "#F2AB30", backgroundColor: "#2D2010" },
  vehicleTypeEmoji: { fontSize: 32, marginBottom: 8 },
  vehicleTypeName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9CA3AF",
    marginBottom: 4,
  },
  vehicleTypeNameActive: { color: "#F2AB30" },
  vehicleTypeDesc: { fontSize: 11, color: "#6B7280", textAlign: "center" },
  vehicleTypeCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F2AB30",
    justifyContent: "center",
    alignItems: "center",
  },

  // Section tag
  sectionTag: {
    backgroundColor: "#1F2937",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#F2AB30",
  },
  sectionTagTxt: {
    fontSize: 11,
    fontWeight: "800",
    color: "#F2AB30",
    letterSpacing: 1,
  },

  // Doc upload
  docWrap: {
    backgroundColor: "#1F2937",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#374151",
  },
  docHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  docLabel: { fontSize: 14, fontWeight: "700", color: "#fff", flex: 1 },
  docSub: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  docPreview: { borderRadius: 10, overflow: "hidden", position: "relative" },
  docImg: { width: "100%", height: 140, borderRadius: 10 },
  docChange: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  docChangeTxt: { fontSize: 12, color: "#F2AB30", fontWeight: "600" },
  docActions: { flexDirection: "row", gap: 10 },
  docBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: "#F2AB30",
    borderRadius: 10,
  },
  docBtnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#F2AB30",
  },
  docBtnTxt: { fontSize: 14, fontWeight: "700", color: "#1F2937" },

  optional: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
    marginTop: 4,
    marginBottom: 8,
  },

  // Info card
  infoCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#064E3B",
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#10B981",
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  infoCardDesc: { fontSize: 13, color: "#6EE7B7", lineHeight: 18 },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#1F2937",
    backgroundColor: "#111827",
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: "#F2AB30",
    borderRadius: 14,
    marginBottom: 10,
  },
  ctaBtnTxt: { fontSize: 16, fontWeight: "800", color: "#1F2937" },
  secondaryBtn: { paddingVertical: 10, alignItems: "center" },
  secondaryBtnTxt: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
});
