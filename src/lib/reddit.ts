import type { Message, MessageContent, OnServerEventCallback, Thread, User } from '@textshq/platform-sdk'
import type { CookieJar } from 'tough-cookie'
import { v4 as uuid } from 'uuid'
import FormData from 'form-data'
import fs from 'fs/promises'

import { MOBILE_USERAGENT, OAUTH_CLIENT_ID_B64, RedditURLs, WEB_USERAGENT } from './constants'
import { mapChannelMember, mapThread } from '../mappers'
import Http from './http'
import RealTime from './real-time'
import Store from './store'

export const sleep = (timeout: number) => new Promise(resolve => {
  setTimeout(resolve, timeout)
})

class RedditAPI {
  store = new Store()

  cookieJar: CookieJar

  http: Http

  apiToken: string

  sendbirdToken: string

  clientVendorUUID: string

  wsClient: RealTime

  sendbirdUserId: string

  currentUser: Record<string, string>

  redditSession: Record<string, string> = {}

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
    this.currentUser = user

    await this.saveRedditSession()
  }

  saveRedditSession = async () => {
    const { body } = await this.http.requestAsString(RedditURLs.HOME)
    const endPart = body.split('<script id="data">').pop()
    let contentScript = endPart.split('</script>').shift()
    const start = contentScript.indexOf('{')
    contentScript = contentScript.substring(start, contentScript.length - 1)
    const dataContent = JSON.parse(contentScript)

    const { loid, version, loidCreated, blob } = dataContent.user.loid

    this.redditSession = {
      session: dataContent.user.sessionTracker,
      loid: `${loid}.${version}.${loidCreated}.${blob}`,
    }
  }

  getRedditHeaders = () => ({
    accept: '*/*',
    'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
    authorization: `Bearer ${this.apiToken}`,
    'content-type': 'application/json',
    'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="96", "Google Chrome";v="96"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'x-reddit-loid': this.redditSession.loid,
    'x-reddit-session': this.redditSession.session,
    Referer: 'https://www.reddit.com/',
    'Referrer-Policy': 'origin-when-cross-origin',
  })

  // FIXME: Use states and types instead of sessionKey to check if
  // connected
  waitUntilWsReady = async () => {
    while (!this.wsClient?.sessionKey) {
      await sleep(500)
    }
  }

  connect = async (userId: string, onEvent: OnServerEventCallback): Promise<void> => {
    this.wsClient = new RealTime(onEvent, this.store)
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
      prev_limit: 200,
      next_limit: 200,
      include: 'true',
      reverse: 'false',
      message_ts: cursor || Date.now(),
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

  sendMedia = async (clientMessageId: string, threadID: string, content: MessageContent): Promise<void> => {
    const data = content.filePath ? await fs.readFile(content.filePath) : content.fileBuffer

    const headers = this.getRedditHeaders()

    const [, id] = threadID.split('channel_')

    const messagePetitionRes = await this.http.post(RedditURLs.API_GRAPHQL, {
      searchParams: { request_timestamp: Date.now() },
      body: `{\"id\":\"b0bb6207e12d\",\"variables\":{\"input\":{\"channelId\":\"${id}\",\"messageData\":\"{\\\"v1\\\":{\\\"clientMessageId\\\":\\\"${clientMessageId}\\\",\\\"highlights\\\":[],\\\"is_hidden\\\":true,\\\"image\\\":{}}}\",\"message\":\"blob:https://www.reddit.com/f6841d09-dcdf-4c4e-8f0b-56e1885daaf8\",\"messageType\":\"IMAGE\"}}}`,
      headers,
    })

    const res = await this.http.post(RedditURLs.API_GRAPHQL, {
      searchParams: { request_timestamp: Date.now() },
      body: '{"id":"df597bfa6e5f","variables":{"input":{"mimetype":"PNG"}}}',
      headers,
    })

    const { createMediaUploadLease } = res?.data || {}
    const { uploadLeaseUrl, uploadLeaseHeaders } = createMediaUploadLease.uploadLease

    const form = new FormData()

    for (const currentHeader of uploadLeaseHeaders) {
      form.append(currentHeader.header, currentHeader.value)
    }

    form.append('file', data)

    await this.http.http.requestAsString(uploadLeaseUrl, {
      method: 'POST',
      cookieJar: this.http.cookieJar,
      body: form,
      headers: {
        accept: '*/*',
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
        'content-type': `multipart/form-data; boundary=${form.getBoundary()}`,
        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="96", "Google Chrome";v="96"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        Referer: 'https://www.reddit.com/',
        'Referrer-Policy': 'origin-when-cross-origin',
      },
    })

    const { mediaId } = createMediaUploadLease
    const { messageRedditId } = messagePetitionRes.data?.createChatMessage?.message || {}

    await this.http.post(RedditURLs.API_GRAPHQL, {
      searchParams: { request_timestamp: Date.now() },
      body: `{\"id\":\"6a1841b659af\",\"variables\":{\"input\":{\"mediaId\":\"${mediaId}\",\"redditId\":\"${messageRedditId}\"}}}`,
      headers,
    })
  }

  sendMessage = async (threadID: string, content: MessageContent): Promise<Message[] | boolean> => {
    const res = await this.wsClient.sendMessage(threadID, content)
    if (!res?.length && !content.fileName) return false

    let mediaPromise = new Promise(resolve => { resolve([]) })
    if (content.fileName) {
      const clientMessageId = uuid()
      mediaPromise = new Promise(resolve => {
        this.sendMedia(clientMessageId, threadID, content)
        this.store.savePromise(clientMessageId, resolve)
      })
    }

    const messages = await Promise.all([res, mediaPromise])
    return messages.flatMap(data => data) as Message[]
  }

  searchUsers = async (typed: string): Promise<User[]> => {
    // https://oauth.reddit.com/api/subreddit_autocomplete_v2.json?query=user&raw_json=1&gilding_detail=1
    const params = {
      query: typed,
      raw_json: 1,
      gilding_detail: 1,
      include_profiles: 1,
      limit: 10,
    }

    const headers = {
      'User-Agent': WEB_USERAGENT,
      Authorization: `Bearer ${this.apiToken}`,
    }

    const url = `${RedditURLs.API_OAUTH}/api/subreddit_autocomplete_v2.json`

    const res = await this.http.get(url, { searchParams: params, headers })
    let data = (res?.data?.children || []).filter(result => result?.kind === 't2')
    // This is because for some reason there are some cases where the search doesn't work
    // (for example if we search 'kishanb' for some reason it doesn't show any result)
    if (!data.length) {
      // Example: https://oauth.reddit.com/user/asdasd/about?raw_json=1&gilding_detail=1
      const aboutUrl = `${RedditURLs.API_OAUTH}/user/${typed}/about`
      const aboutRes = await this.http.get(aboutUrl, { searchParams: { raw_json: 1, gilding_detail: 1 }, headers }).catch(() => ({}))
      data = [aboutRes]
    }

    return data.map(({ data: userData }) => mapChannelMember(userData))
  }

  createThread = async (userIDs: string[], title: string): Promise<Thread> => {
    const users = [
      { user_id: this.sendbirdUserId, nickname: this.currentUser.nickname || this.currentUser.name },
      ...userIDs.map(id => ({ user_id: id })),
    ]

    const headers = {
      'User-Agent': WEB_USERAGENT,
      Authorization: `Bearer ${this.apiToken}`,
    }

    const data = JSON.stringify({ users, name: title || 'New Group' })

    const url = `${RedditURLs.API_S}/api/v1/sendbird/group_channels`
    const res = await this.http.post(url, { body: data, headers })

    return mapThread(res, this.sendbirdUserId)
  }

  deleteThread = async (threadID: string) => {
    try {
      const url = `${RedditURLs.SENDBIRD_PROXY}/v3/group_channels/${threadID}`
      await this.http.base(url, {
        headers: { 'Session-Key': this.wsClient.sessionKey },
        method: 'DELETE',
      })
    } catch (error) {
      const body = JSON.stringify({ user_id: this.sendbirdUserId })
      const url = `${RedditURLs.SENDBIRD_PROXY}/v3/group_channels/${threadID}/leave`
      await this.http.base(url, {
        headers: { 'Session-Key': this.wsClient.sessionKey },
        method: 'PUT',
        body,
      })
    }
  }

  deleteMessage = async (threadID: string, messageID: string) => {
    const url = `${RedditURLs.SENDBIRD_PROXY}/v3/group_channels/${threadID}/messages/${messageID}`
    await this.http.base(url, {
      headers: { 'Session-Key': this.wsClient.sessionKey },
      method: 'DELETE',
    })
  }

  sendTyping = async (threadID: string) => {
    await this.wsClient.sendTyping(threadID)
  }
}

export default RedditAPI
