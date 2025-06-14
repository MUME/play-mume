const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    main: './src/index.ts',
    map: './src/map-loader.ts',
  },
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.scss$/i,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
      filename: 'index.html',
      inject: 'body',
      scriptLoading: 'defer',
      chunks: ['main'],
    }),
    new HtmlWebpackPlugin({
      template: './map.html',
      filename: 'map.html',
      inject: 'body',
      scriptLoading: 'defer',
      chunks: ['map'],
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'mapdata', to: 'mapdata', noErrorOnMissing: true },
        { from: 'resources', to: 'resources' },
        { from: 'icons', to: 'icons' },
        { from: 'manifest.webmanifest', to: 'manifest.webmanifest' },
        { from: 'sw.js', to: 'sw.js' },
        {
          from: 'DecafMUD',
          to: 'DecafMUD',
          globOptions: {
            ignore: [
              '**/build/**',
              '**/docs/**',
              '**/flash/**',
            ],
          },
        },
      ],
    }),
  ],
};
