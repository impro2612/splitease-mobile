module.exports = function (api) {
  api.cache(true);
  return {
    // reanimated 3 ships its own Babel plugin; the preset's worklets plugin is for reanimated 4
    presets: [["babel-preset-expo", { reanimated: false, worklets: false }]],
    plugins: ["react-native-reanimated/plugin"],
  };
};
