module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind", reanimated: false, worklets: false }],
      "./babel-nativewind",
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};
