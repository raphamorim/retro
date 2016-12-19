const webpack = require('webpack');
const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

module.exports = {
  target: 'electron',
  devtool: isProd ? 'hidden-source-map' : 'cheap-eval-source-map',
  context: __dirname + '/src',
  module: {
    loaders: [{
      test: /.js?$/,
      loader: 'babel-loader',
      exclude: /node_modules/,
      query: {
        presets: ['es2015']
      }
    }]
  },
  entry: [
    './index.js'
  ],
  output: {
    path: __dirname + '/dist',
    filename: 'retro.js'
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(nodeEnv)
      }
    }),
    new webpack.optimize.UglifyJsPlugin(),
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.LoaderOptionsPlugin({
      debug: false,
      minimize: true
    })
  ]
}