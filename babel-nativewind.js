// Custom wrapper for nativewind/babel that excludes react-native-worklets/plugin.
// react-native-css-interop/babel.js hardcodes that plugin which requires new architecture.
// We have newArchEnabled: false, so we omit it here.
module.exports = function () {
  return {
    plugins: [
      require("react-native-css-interop/dist/babel-plugin").default,
      [
        "@babel/plugin-transform-react-jsx",
        {
          runtime: "automatic",
          importSource: "react-native-css-interop",
        },
      ],
    ],
  };
};
