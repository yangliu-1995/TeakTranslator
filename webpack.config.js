const path = require('path');

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === 'development';

  return {
    entry: './src/index.ts',
    output: {
      filename: 'TeakTranslator.js',
      path: path.resolve(__dirname, 'dist'),
      library: 'Teak',
      libraryTarget: 'var',
      libraryExport: 'default'
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    mode: argv.mode || 'production',
    // Only generate source maps in development mode
    devtool: isDevelopment ? 'source-map' : false,
    // Disable minification in development mode
    optimization: {
      minimize: !isDevelopment,
      usedExports: !isDevelopment
    }
  };
};
