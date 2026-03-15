import * as ImagePicker from "expo-image-picker";

/**
 * Solicitar permisos de cámara
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    console.log("📷 Camera permission status:", status);
    return status === "granted";
  } catch (error) {
    console.error("❌ Error requesting camera permission:", error);
    return false;
  }
}

/**
 * Solicitar permisos de galería
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log("🖼️ Media library permission status:", status);
    return status === "granted";
  } catch (error) {
    console.error("❌ Error requesting media library permission:", error);
    return false;
  }
}

/**
 * Solicitar ambos permisos
 */
export async function requestAllImagePermissions(): Promise<{
  camera: boolean;
  mediaLibrary: boolean;
}> {
  const cameraPermission = await requestCameraPermission();
  const mediaLibraryPermission = await requestMediaLibraryPermission();

  return {
    camera: cameraPermission,
    mediaLibrary: mediaLibraryPermission,
  };
}

/**
 * Tomar foto con manejo de permisos
 */
export async function takePhotoWithPermission(
  setter: React.Dispatch<React.SetStateAction<any>>,
  field: string,
): Promise<void> {
  try {
    // Solicitar permisos
    const hasCameraPermission = await requestCameraPermission();

    if (!hasCameraPermission) {
      alert(
        "Camera permission is required. Please enable it in your device settings.",
      );
      return;
    }

    // Tomar foto
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setter((prev: any) => ({
        ...prev,
        [field]: result.assets[0].uri,
      }));
      console.log("✅ Photo taken successfully");
    }
  } catch (error) {
    console.error("❌ Error taking photo:", error);
    alert("Error taking photo. Please try again.");
  }
}

/**
 * Seleccionar imagen de galería con manejo de permisos
 */
export async function pickImageWithPermission(
  setter: React.Dispatch<React.SetStateAction<any>>,
  field: string,
): Promise<void> {
  try {
    // Solicitar permisos
    const hasMediaLibraryPermission = await requestMediaLibraryPermission();

    if (!hasMediaLibraryPermission) {
      alert(
        "Media library permission is required. Please enable it in your device settings.",
      );
      return;
    }

    // Seleccionar imagen
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setter((prev: any) => ({
        ...prev,
        [field]: result.assets[0].uri,
      }));
      console.log("✅ Image selected successfully");
    }
  } catch (error) {
    console.error("❌ Error picking image:", error);
    alert("Error selecting image. Please try again.");
  }
}
