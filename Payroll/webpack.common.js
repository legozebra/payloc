const pathMod = require('path');
const glob = require('glob');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const webpack = require('webpack');

// {
//   calManager: './src/calManager.js'
// }

const path = pathMod.resolve(__dirname, 'static/js/dist');
module.exports = {
  entry: glob.sync('./src/*.js').reduce((entries, entry) => Object.assign(entries, {[entry.split('/').pop().replace('.js', '')]: entry}), {}),
  output: {
    filename: '[name].min.js',
    sourceMapFilename: "[name].js.map",
    path: path
  },
  plugins: [
    new CleanWebpackPlugin(['dist']),
    new webpack.optimize.CommonsChunkPlugin({
     name: 'common' // Specify the common bundle's name.
   })
  ],
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader', // Babel loader for es6 support on that goddamnned IE8
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: require.resolve('Hammerjs'),
        use: [{
          loader: 'expose-loader',
          options: 'expose?Hammer!hammerjs/hammer'
        }]},
      {
        test: require.resolve('jquery'),
        use: [{
          loader: 'expose-loader',
          options: 'expose?$!expose?jQuery'
        }]
      },
      {
        test: require.resolve('moment'),
        use: [{
          loader: 'expose-loader',
          options: 'expose?$moment'
        }]
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf|png)$/,
        use: [{
          loader: 'file-loader',
          options: {
            publicPath: '/js/dist/'
          }
        }]
      }
    ]
  }
};