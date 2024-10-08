// FIXME: Remove this
/* eslint-disable no-throw-literal */
import type { CookieJar } from 'tough-cookie'
import { FetchOptions, texts } from '@textshq/platform-sdk'
import { ExpectedJSONGotHTMLError } from '@textshq/platform-sdk/dist/json'
import { commonHeaders } from './constants'

const isStatusCodeError = (status: number): boolean => status !== 304 && status >= 400

class Http {
  readonly http = texts.createHttpClient()

  constructor(readonly cookieJar: CookieJar) {}

  async requestAsString(url: string, config: FetchOptions = {}) {
    const res = await this.http.requestAsString(url, {
      cookieJar: this.cookieJar,
      ...config,
    })
    return res
  }

  async base<ResponseType = any>(
    url: string,
    config: FetchOptions = {},
  ) {
    const res = await this.requestAsString(url, {
      cookieJar: this.cookieJar,
      ...config,
      headers: {
        ...commonHeaders,
        ...(config.headers || {}),
      }
    })

    if (res.body[0] === '<') {
      console.log(res.statusCode, url, res.body)
      throw new ExpectedJSONGotHTMLError(res.statusCode, res.body)
    }
    const body = JSON.parse(res.body || 'null')
    const isError = isStatusCodeError(res.statusCode) || body?.error

    if (isError) throw Error(body?.error?.reason || res.statusCode)

    return body as ResponseType
  }

  get = <ResponseType = any>(
    url: string,
    config: FetchOptions = {},
  ) => this.base<ResponseType>(url, { method: 'GET', ...config })

  post = <ResponseType = any>(
    url: string,
    config: FetchOptions = {},
  ) => this.base<ResponseType>(url, { method: 'POST', ...config })
}

export default Http
