import proxy from 'koa-better-http-proxy'
import Koa from 'koa'
import MemoMap from './MemoMap'
import mime from 'mime-types'
import { createReadStream, readFile } from 'fs'
import { DEV, FRONTEND_URI } from './const'

export const serveFrontend = DEV ? serveProxyFrontend() : serveStaticFrontend()

function serveProxyFrontend() {
    console.debug('fronted: proxied')
    return proxy('localhost:3000', {
        proxyReqPathResolver: (ctx) => ctx.path.endsWith('/') ? '/' : ctx.path,
        userResDecorator: (res, data, req) => {
            return req.url.endsWith('/') ? replaceFrontEndRes(data.toString('utf8'))
                : data
        }
    })
}

function serveStaticFrontend() : Koa.Middleware {
    const BASE = __dirname + (DEV ? '/../dist' : '') + '/frontend/'
    const cache = new MemoMap()
    return async (ctx, next) => {
        let file = ctx.path
        if (file.endsWith('/'))
            file = '/'
        if (file.startsWith('/'))
            file = file.slice(1)
        const untouched = Boolean(file)
        ctx.body = untouched ? createReadStream(BASE + file)
            : await cache.getOrSet(file, () =>
                filePromise(BASE + (file || 'index.html')).then(res =>
                    replaceFrontEndRes(res.toString('utf8')) ))
        ctx.type = file ? (mime.lookup(file) || 'application/octet-stream') : 'html'
        await next()
    }
}

function filePromise(path: string) : Promise<Buffer> {
    return new Promise((resolve, reject) =>
        readFile(path, (err,res) =>
            err ? reject(err) : resolve(res) ))
}

function replaceFrontEndRes(body: string) {
    return body.replace(/((?:src|href) *= *['"])\/?(?![a-z]+:\/\/)/g, '$1'+FRONTEND_URI)
}