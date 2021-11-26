import type { Message, MessageContent, OnServerEventCallback } from '@textshq/platform-sdk'
import type { CookieJar } from 'tough-cookie'
import { v4 as uuid } from 'uuid'

import { MOBILE_USERAGENT, OAUTH_CLIENT_ID_B64, RedditURLs, WEB_USERAGENT } from './constants'
import Http from './http'
import RealTime from './real-time'

export const sleep = (timeout: number) => new Promise(resolve => {
  setTimeout(resolve, timeout)
})

class RedditAPI {
  cookieJar: CookieJar

  http: Http

  apiToken: string

  sendbirdToken: string

  clientVendorUUID: string

  wsClient: RealTime

  sendbirdUserId: string

  init = async ({ apiToken = '', cookieJar }: { cookieJar: CookieJar, apiToken?: string }) => {
    this.cookieJar = cookieJar
    this.clientVendorUUID = uuid()
    this.http = new Http(this.cookieJar)

    const redditTokenPromise = apiToken ? this.reauthenticate(apiToken) : this.getApiToken()
    const redditToken = await redditTokenPromise

    this.apiToken = redditToken

    const sendbirdToken = await this.getSendbirdToken()
    this.sendbirdToken = sendbirdToken

    const user = await this.getCurrentUser()
    this.sendbirdUserId = `t2_${user?.id}`
  }

  // FIXME: Use states and types instead of sessionKey to check if
  // connected
  waitUntilWsReady = async () => {
    while (!this.wsClient?.sessionKey) {
      await sleep(500)
    }
  }

  connect = async (userId: string, onEvent: OnServerEventCallback): Promise<void> => {
    this.wsClient = new RealTime(onEvent)
    await this.wsClient.connect({ userId, apiToken: this.sendbirdToken })
  }

  reauthenticate = async (apiToken: string): Promise<string> => {
    const headers = {
      'User-Agent': WEB_USERAGENT,
      Authorization: `Bearer ${apiToken}`,
    }

    const data = {
      accessToken: apiToken,
      unsafeLoggedOut: 'false',
      safe: 'true',
    }

    const url = `${RedditURLs.API_OLD}/refreshproxy`
    const res = await this.http.post(url, { headers, body: JSON.stringify(data), cookieJar: this.cookieJar })
    return res?.access_token
  }

  getApiToken = async (): Promise<string> => {
    const headers = {
      Authorization: `Basic ${OAUTH_CLIENT_ID_B64}`,
      'User-Agent': MOBILE_USERAGENT,
      'client-vendor-id': this.clientVendorUUID,
    }

    const url = `${RedditURLs.API_ACCOUNTS}/api/access_token`
    const res = await this.http.post(url, {
      headers,
      cookieJar: this.cookieJar,
      body: '{"scopes":["*"]}',
    })

    return res?.access_token
  }

  getSendbirdToken = async (): Promise<string> => {
    const headers = {
      'User-Agent': MOBILE_USERAGENT,
      Authorization: `Bearer ${this.apiToken}`,
    }

    const res = await this.http.get(`${RedditURLs.API_S}/api/v1/sendbird/me`, { headers, cookieJar: this.cookieJar })
    return res?.sb_access_token
  }

  getCurrentUser = async (): Promise<any> => {
    const headers = {
      'User-Agent': WEB_USERAGENT,
      Authorization: `Bearer ${this.apiToken}`,
    }

    const user = await this.http.get(`${RedditURLs.API_OAUTH}/api/v1/me.json`, { cookieJar: this.cookieJar, headers })
    return user
  }

  getThreads = async (): Promise<any> => {
    await this.waitUntilWsReady()

    const params = {
      limit: '100',
      order: 'latest_last_message',
      show_member: 'true',
      show_read_receipt: 'true',
      show_delivery_receipt: 'true',
      show_empty: 'true',
      member_state_filter: 'joined_only',
      super_mode: 'all',
      public_mode: 'all',
      unread_filter: 'all',
      hidden_mode: 'unhidden_only',
      show_frozen: 'true',
    }

    const url = `${RedditURLs.SENDBIRD_PROXY}/v3/users/${this.sendbirdUserId}/my_group_channels`
    const res = await this.http.get(url, {
      headers: { 'Session-Key': this.wsClient.sessionKey },
      searchParams: params,
    })

    return res
  }

  getMessages = async (threadID: string, cursor: any): Promise<any> => {
    const params = {
      is_sdk: 'true',
      prev_limit: 40,
      next_limit: 40,
      include: 'false',
      reverse: 'false',
      message_ts: cursor || new Date().getTime(),
      custom_types: '*',
      with_sorted_meta_array: 'false',
      include_reactions: 'false',
      include_thread_info: 'false',
      include_replies: 'false',
      include_parent_message_text: 'false',
    }

    const url = `${RedditURLs.SENDBIRD_PROXY}/v3/group_channels/${threadID}/messages`
    const res = await this.http.get(url, {
      headers: { 'Session-Key': this.wsClient.sessionKey },
      searchParams: params,
    })

    return res
  }

  sendMessage = async (threadID: string, content: MessageContent): Promise<Message[]> => {
    const res = await this.wsClient.sendMessage(threadID, content)
    return res
  }
}

export default RedditAPI
