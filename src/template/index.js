import React from 'react'
import fs from 'fs'
import { renderToString } from 'react-dom/server'
import App  from '../containers/App'
import template from './template'

const appString = renderToString(<App/>)
fs.writeFileSync(`${process.cwd()}/index.html`, template(appString), 'utf-8')
