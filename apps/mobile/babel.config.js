module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // react-native-worklets/plugin (wymagany przez reanimated 4) jest dodawany automatycznie przez babel-preset-expo w SDK 57.
  };
};
