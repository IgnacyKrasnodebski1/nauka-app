import type { ExpoConfig, ConfigContext } from "expo/config";

/**
 * NAUKA — konfiguracja Expo.
 * Env (EXPO_PUBLIC_*) czytane są bezpośrednio w kodzie przez process.env — patrz src/lib/env.ts i .env.example.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "NAUKA",
  slug: "nauka",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "nauka",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  backgroundColor: "#0a0a12",
  ios: {
    bundleIdentifier: "pl.nauka.app",
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription: "NAUKA robi zdjęcia Twoich notatek i slajdów, żeby zamienić je w lekcje.",
      NSPhotoLibraryUsageDescription: "NAUKA wybiera zdjęcia materiałów z galerii, żeby zamienić je w lekcje.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "pl.nauka.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0a0a12",
    },
    permissions: ["CAMERA", "READ_MEDIA_IMAGES"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: false,
        data: [{ scheme: "nauka", host: "auth" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/icon.png",
  },
  plugins: [
    "expo-router",
    "expo-web-browser",
    [
      "expo-splash-screen",
      { image: "./assets/splash.png", resizeMode: "contain", backgroundColor: "#0a0a12", imageWidth: 200 },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "NAUKA wybiera zdjęcia materiałów z galerii, żeby zamienić je w lekcje.",
        cameraPermission: "NAUKA robi zdjęcia Twoich notatek i slajdów, żeby zamienić je w lekcje.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      // uzupełnij po `eas init` (projectId z expo.dev)
      projectId: process.env.EAS_PROJECT_ID ?? undefined,
    },
  },
});
