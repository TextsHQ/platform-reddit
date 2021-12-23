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
  private store = new Store()

  private cookieJar: CookieJar

  http: Http

  apiToken: string

  private sendbirdToken: string

  private clientVendorUUID: string

  private wsClient: RealTime

  private sendbirdUserId: string

  private currentUser: Record<string, string>

  private redditSession: Record<string, string> = {}

  init = async ({
    apiToken = '',
    cookieJar,
  }: {
    cookieJar: CookieJar
    apiToken?: string
  }): Promise<Record<string, any>> => {
    this.cookieJar = cookieJar
    this.clientVendorUUID = uuid()
    this.http = new Http(this.cookieJar)

    const redditTokenPromise = apiToken ? this.reauthenticate(apiToken) : this.getApiToken()
    const redditToken = await redditTokenPromise

    this.apiToken = redditToken

    const promises = [this.getSendbirdToken(), this.getCurrentUser(), this.saveRedditSession()]
    const res = await Promise.all(promises)
    const [sendbirdToken, user] = res

    this.sendbirdToken = sendbirdToken
    this.sendbirdUserId = `t2_${user?.id}`
    this.currentUser = user

    return user
  }

  private saveRedditSession = async () => {
    const { body } = await this.http.requestAsString(RedditURLs.HOME)
    if (!body.includes('window.___r')) throw Error(`"window.___r" not found in ${RedditURLs.HOME}`)

    const [, json] = /window\.___r\s?=\s?(.+?);?<\/script>/.exec(body) || []
    if (!json) throw Error('regex match for json failed')

    const dataContent = JSON.parse(json)

    const { loid, version, loidCreated, blob } = dataContent.user.loid
    this.redditSession = {
      session: dataContent.user.sessionTracker,
      loid: `${loid}.${version}.${loidCreated}.${blob}`,
    }
  }

  private getRedditHeaders = () => ({
    accept: '*/*',
    'accept-language': 'en',
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

  private reauthenticate = async (apiToken: string): Promise<string> => {
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

  private getApiToken = async (): Promise<string> => {
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

  private getSendbirdToken = async (): Promise<string> => {
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
      // In case we want to implement another "Inbox" type we have this filter
      // member_state_filter: 'joined_only',
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

  getMessages = async (threadID: string, cursor = Date.now()): Promise<any> => {
    const params = {
      is_sdk: 'true',
      prev_limit: 40,
      next_limit: 0,
      include: 'false',
      reverse: 'false',
      message_ts: cursor,
      custom_types: '*',
      with_sorted_meta_array: 'false',
      include_reactions: 'true',
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
    const [, mimetype] = content.mimeType.split('/')

    const messagePetitionRes = await this.http.post(RedditURLs.API_GRAPHQL, {
      searchParams: { request_timestamp: Date.now() },
      body: JSON.stringify({
        id: 'b0bb6207e12d',
        variables: {
          input: {
            channelId: id,
            messageData: JSON.stringify({
              v1: {
                clientMessageId,
                highlights: [],
                is_hidden: true,
                image: {},
              },
            }),
            message: `blob:https://www.reddit.com/${uuid()}`,
            messageType: 'IMAGE',
          },
        },
      }),
      headers,
    })

    const res = await this.http.post(RedditURLs.API_GRAPHQL, {
      searchParams: { request_timestamp: Date.now() },
      headers,
      body: JSON.stringify({
        id: 'df597bfa6e5f',
        variables: {
          input: { mimetype: mimetype.toUpperCase() },
        },
      }),
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
        'accept-language': 'en',
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
      body: JSON.stringify({
        id: '6a1841b659af',
        variables: {
          input: {
            mediaId,
            redditId: messageRedditId,
          },
        },
      }),
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

  sendReadReceipt = async (threadID: string): Promise<void> => {
    await this.wsClient.sendReadReceipt(threadID)
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

    return data.map(({ data: userData }) => mapChannelMember(userData || {})).filter(Boolean)
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

  addReaction = async (threadID: string, messageID: string, reactionKey: string) => {
    const headers = this.getRedditHeaders()
    const [, id] = threadID.split('channel_')
    const payload = {
      id: '2a0ff72d302a',
      variables: {
        input: {
          channelSendbirdId: id,
          type: 'ADD',
          reactionIconKey: reactionKey,
          messageSendbirdId: messageID,
        },
      },
    }

    await this.http.post(RedditURLs.API_GRAPHQL, {
      searchParams: { request_timestamp: Date.now() },
      body: JSON.stringify(payload),
      headers,
    })
  }

  removeReaction = async (threadID: string, messageID: string, reactionKey: string) => {
    const headers = this.getRedditHeaders()
    const [, id] = threadID.split('channel_')
    const payload = {
      id: '2a0ff72d302a',
      variables: {
        input: {
          channelSendbirdId: id,
          type: 'DELETE',
          messageSendbirdId: messageID,
          reactionIconKey: reactionKey,
        },
      },
    }

    await this.http.post(RedditURLs.API_GRAPHQL, {
      searchParams: { request_timestamp: Date.now() },
      body: JSON.stringify(payload),
      headers,
    })
  }
}

export default RedditAPI
