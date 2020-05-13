const merge = require('webpack-merge');
const config = require('./config');
const path = require('path');
const common = require('./webpack.common.js');
const webpack = require('webpack');

module.exports = merge(common, {
  plugins: [
    new webpack.HotModuleReplacementPlugin()
  ],
  devServer: {
    host: 'localhost', // Defaults to `localhost`
    port: config.portInDev, // Defaults to 8080
    contentBase: path.join(__dirname, "static"),
    hot: true,
    publicPath: `http://localhost:${config.portInDev}/js/dist/`,
    proxy: {
      //'/^((?!js).)*$/g
      '/': {
        target: 'http://127.0.0.1:' + String(Number(Number(config.portInDev) + 1000)) + '/',
        secure: false
      }
    }
  },
});