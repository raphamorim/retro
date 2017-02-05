const webpack = require('webpack')
const path = require('path')
const fs = require('fs')
const WebpackShellPlugin = require('webpack-shell-plugin')

const nodeEnv = process.env.NODE_ENV || 'development'
const isProd = nodeEnv === 'production'

let nodeModules = {}

fs.readdirSync('node_modules')
	.filter((x) => ['.bin'].indexOf(x) === -1)
	.forEach((mod) => nodeModules[mod] = 'commonjs ' + mod)

module.exports = [{
	target: 'electron',
	devtool: isProd ? 'hidden-source-map' : 'cheap-eval-source-map',
	context: __dirname + '/src',
	module: {
		loaders: [{
			test: /.js?$/,
			loader: 'babel-loader',
			exclude: /node_modules/,
			query: {
				presets: ['es2015', 'react']
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
		// new webpack.optimize.UglifyJsPlugin(),
		new webpack.optimize.OccurrenceOrderPlugin(),
		new webpack.LoaderOptionsPlugin({
			debug: false,
			minimize: true
		})
	]
}
// , {
// 	target: 'node',
// 	context: __dirname + '/src',
// 	entry: [
// 		'./template/index.js'
// 	],
// 	output: {
// 		path: __dirname + '/dist',
// 		filename: 'template.js'
// 	},
// 	module: {
// 		loaders: [{
// 			test: /.js?$/,
// 			loader: 'babel-loader',
// 			exclude: /node_modules/,
// 			query: {
// 				presets: ['es2015', 'react']
// 			}
// 		}]
// 	},
// 	plugins: [
// 		new WebpackShellPlugin({
// 			onBuildStart: [ 'echo "Building index.html"' ],
// 			onBuildEnd: [ 'node ./dist/template.js', 'echo "Builded index.html"' ]
// 		})
// 	],
// 	externals: nodeModules,
// 	devtool: 'sourcemap',
// }
]
