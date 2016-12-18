const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

module.exports = {
  devtool: isProd ? 'hidden-source-map' : 'cheap-eval-source-map',
  context: __dirname + '/src',
  module: {
    loaders: [
      {
        test: /.js?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          presets: ['es2015']
        }
      }
    ]
  },
  entry: [
    './app.js'
  ],
  output: {
    path: __dirname + '/dist',
    filename: "retro.js"
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': { // eslint-disable-line quote-props
        NODE_ENV: JSON.stringify(nodeEnv)
      }
    })
  ],
  target: 'electron'
}
