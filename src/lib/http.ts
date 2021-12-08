// FIXME: Remove this
/* eslint-disable no-throw-literal */
import type { CookieJar } from 'tough-cookie'
import { FetchOptions, texts } from '@textshq/platform-sdk'

class Http {
  http = texts.createHttpClient()

  cookieJar: CookieJar

  constructor(cookieJar: CookieJar) {
    this.cookieJar = cookieJar
  }

  isStatusCodeError = (status: number): boolean => status !== 304 && status >= 400

  async get<ResponseType = any>(
    url: string,
    config: FetchOptions = {},
  ) {
    const res = await this.http.requestAsString(url, {
      method: 'GET',
      cookieJar: this.cookieJar,
      ...config,
    })

    const body = JSON.parse(res.body || '{}')
    const isError = this.isStatusCodeError(res.statusCode) || body?.error

    if (isError) throw { ...body.error }

    return body as ResponseType
  }

  async post<ResponseType = any>(
    url: string,
    config: FetchOptions = {},
  ) {
    const res = await this.http.requestAsString(url, {
      method: 'POST',
      cookieJar: this.cookieJar,
      ...config,
    })

    const body = JSON.parse(res.body || '{}')
    const isError = this.isStatusCodeError(res.statusCode) || body?.error || body?.errors?.length

    if (isError) throw { ...body.error }

    return body as ResponseType
  }

  async base<ResponseType = any>(
    url: string,
    config: FetchOptions = {},
  ) {
    const res = await this.http.requestAsString(url, {
      cookieJar: this.cookieJar,
      ...config,
    })

    const body = JSON.parse(res.body || '{}')
    const isError = this.isStatusCodeError(res.statusCode) || body?.error

    if (isError) throw { ...body.error }

    return body as ResponseType
  }

  async requestAsString(url: string, config: FetchOptions = {}) {
    const res = await this.http.requestAsString(url, {
      cookieJar: this.cookieJar,
      ...config,
    })

    return res
  }
}

export default Http
