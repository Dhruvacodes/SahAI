/**
 * Provides the default Expo Babel preset for React Native TypeScript.
 *
 * @param {import("@babel/core").ConfigAPI} api - Babel configuration API.
 * @returns {import("@babel/core").TransformOptions} Babel options for Expo.
 */
module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"]
  };
};

