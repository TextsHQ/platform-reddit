import { randomUUID as uuid } from 'crypto'
import FormData from 'form-data'
import { promises as fs } from 'fs'
import { setTimeout as sleep } from 'timers/promises'
import type { Message, MessageContent, OnServerEventCallback, Thread, User } from '@textshq/platform-sdk'
import type { CookieJar } from 'tough-cookie'

import { MOBILE_USERAGENT, OAUTH_CLIENT_ID_B64, RedditURLs, WEB_USERAGENT } from './constants'
import { getSendbirdId, mapChannelMember, mapInboxMessages, mapMessages, mapThread } from '../mappers'
import SendbirdRealTime from './real-time/sendbird'
import InboxRealTime from './real-time/inbox'
import PromiseStore from './promise-store'
import Http from './http'

import type { MeResult, RedditUser } from './types'
import type { InboxChild, InboxResponse, ReplyChild } from './types/inbox'

class RedditAPI {
  private promiseStore = new PromiseStore()

  private cookieJar: CookieJar

  http: Http

  apiToken: string

  private sendbirdToken: string

  private clientVendorUUID: string

  private wsClient: SendbirdRealTime

  private inboxRealtimeClient: InboxRealTime

  private sendbirdUserId: string

  private currentUser: RedditUser

  private redditSession: Record<string, string> = {}

  private lastThreadCursor: string | null

  private showInbox: boolean

  init = async ({ apiToken = '', cookieJar, showInbox = false }: { cookieJar: CookieJar, apiToken?: string, showInbox?: boolean }): Promise<RedditUser> => {
    this.showInbox = showInbox
    this.cookieJar = cookieJar
    this.clientVendorUUID = uuid()
    this.http = new Http(this.cookieJar)

    const redditTokenPromise = apiToken ? this.reauthenticate(apiToken) : this.getApiToken()
    const redditToken = await redditTokenPromise

    this.apiToken = redditToken

    const promises = [this.getSendbirdToken(), this.getCurrentUser(), this.saveRedditSession()]
    const res = await Promise.all(promises)
    const [sendbirdToken, user] = res as [string, RedditUser, void]

    this.sendbirdToken = sendbirdToken
    this.sendbirdUserId = user.sendbird_id
    this.currentUser = user

    return user
  }

  private saveRedditSession = async () => {
    const { body } = await this.http.requestAsString(RedditURLs.HOME_NEW)
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
    this.wsClient = new SendbirdRealTime(onEvent, this.promiseStore)
    await this.wsClient.connect({ userId, apiToken: this.sendbirdToken })

    if (this.showInbox) {
      this.inboxRealtimeClient = new InboxRealTime(onEvent, this.http, this.apiToken)
      await this.inboxRealtimeClient.connect(this.currentUser.name)
    }
  }

  dispose = async () => {
    await this.wsClient.dispose()
    this.wsClient = null

    if (this.showInbox) {
      this.inboxRealtimeClient.disconnect()
      this.inboxRealtimeClient = null
    }
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

    const url = `${RedditURLs.HOME_OLD}/refreshproxy`
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

  getCurrentUser = async (): Promise<RedditUser> => {
    const headers = {
      'User-Agent': WEB_USERAGENT,
      Authorization: `Bearer ${this.apiToken}`,
    }

    const user: MeResult = await this.http.get(`${RedditURLs.API_OAUTH}/api/v1/me.json`, { cookieJar: this.cookieJar, headers })
    const sendbirdId = getSendbirdId(user?.id)

    return { ...user, sendbird_id: sendbirdId }
  }

  private getSendbirdThreads = async (): Promise<Record<string, any>[]> => {
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

  private getInboxThreads = async (): Promise<InboxChild[]> => {
    const url = `${RedditURLs.HOME}/message/messages.json`
    const res: InboxResponse = await this.http.get(url, {
      searchParams: { after: this.lastThreadCursor, limit: 15 },
    })

    for (const thread of res.data.children) {
      const { data } = thread

      const isCurrentUserAuthor = data.author_fullname === this.currentUser.sendbird_id
      const participantName = isCurrentUserAuthor ? data.dest : data.author_fullname
      const participant = await this.getRedditUserData(participantName).catch(() => ({ data: null }))

      if (participant?.data) {
        thread.data.participants = [participant.data]
      }
    }

    this.lastThreadCursor = res.data.after

    return res.data.children
  }

  getThreads = async (): Promise<{ chat: any, inbox?: InboxChild[], nextInboxCursor: string | null }> => {
    await this.waitUntilWsReady()

    const sendBirdThreads = await this.getSendbirdThreads()
    const inboxThreads = this.showInbox ? await this.getInboxThreads() : []

    return {
      chat: sendBirdThreads,
      inbox: inboxThreads || [],
      nextInboxCursor: this.lastThreadCursor,
    }
  }

  private getSendbirdThreadMessages = async (threadID: string, cursor: number): Promise<any> => {
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

  private getInboxThreadMessages = async (threadID: string, cursor: number): Promise<ReplyChild[]> => {
    const url = `${RedditURLs.HOME}/message/messages/${threadID}.json`
    const res: InboxResponse = await this.http.get(url)
    const [firstChild] = res.data.children || []

    return (
      typeof firstChild?.data?.replies === 'string'
        ? []
        : firstChild?.data?.replies.data.children
    )
  }

  getMessages = async (threadID: string, cursor = Date.now()): Promise<Message[]> => {
    const isSendbirdThread = threadID.startsWith('sendbird_')

    const res = isSendbirdThread
      ? await this.getSendbirdThreadMessages(threadID, cursor)
      : await this.getInboxThreadMessages(threadID, cursor)

    const mapped = isSendbirdThread
      ? mapMessages(res?.messages || [], this.currentUser.sendbird_id)
      : mapInboxMessages(res, this.currentUser.name)

    return mapped
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

  private sendSendbirdMessage = async (threadID: string, content: MessageContent): Promise<Message[] | boolean> => {
    const res = await this.wsClient.sendMessage(threadID, content)
    if (!res?.length && !content.fileName) return false

    let mediaPromise = new Promise(resolve => { resolve([]) })
    if (content.fileName) {
      const clientMessageId = uuid()
      mediaPromise = new Promise(resolve => {
        this.sendMedia(clientMessageId, threadID, content)
        this.promiseStore.savePromise(clientMessageId, resolve)
      })
    }

    const messages = await Promise.all([res, mediaPromise])
    return messages.flatMap(data => data) as Message[]
  }

  private sendInboxMessage = async (threadID: string, content: MessageContent): Promise<any> => {
    const url = `${RedditURLs.API_OAUTH}/api/comment/`

    const headers = {
      'User-Agent': WEB_USERAGENT,
      Authorization: `Bearer ${this.apiToken}`,
    }

    const payload = {
      api_type: 'json',
      text: content.text,
      thing_id: `t4_${threadID}`,
    }

    const res = await this.http.post(url, {
      cookieJar: this.cookieJar,
      headers,
      searchParams: { ...payload },
    })

    const hasError = !!(res?.json?.errors?.length)
    if (hasError) {
      const [firstError] = res.json.errors
      const [, message] = firstError
      throw new Error(message)
    }

    return !!(res?.json?.data)
  }

  sendMessage = async (threadID: string, content: MessageContent): Promise<Message[] | boolean> => {
    const isSendbird = threadID.startsWith('sendbird_')
    if (isSendbird) return this.sendSendbirdMessage(threadID, content)

    return this.sendInboxMessage(threadID, content)
  }

  sendReadReceipt = async (threadID: string): Promise<void> => {
    await this.wsClient.sendReadReceipt(threadID)
  }

  private getRedditUserData = async (user: string): Promise<{ data: MeResult }> => {
    const headers = {
      'User-Agent': WEB_USERAGENT,
      Authorization: `Bearer ${this.apiToken}`,
    }

    const url = `${RedditURLs.API_OAUTH}/user/${user}/about`
    // Example: https://oauth.reddit.com/user/asdasd/about?raw_json=1&gilding_detail=1
    const res = await this.http.get(url, { searchParams: { raw_json: 1, gilding_detail: 1 }, headers })

    return res
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
      const aboutRes = await this.getRedditUserData(typed).catch(() => ({}))
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

  private deleteSendbirdThread = async (threadID: string) => {
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

  deleteThread = async (threadID: string) => {
    if (threadID.startsWith('sendbird_')) return this.deleteSendbirdThread(threadID)

    return this.deleteInboxMessage(threadID)
  }

  private deleteSendbirdMessage = async (threadID: string, messageID: string) => {
    const url = `${RedditURLs.SENDBIRD_PROXY}/v3/group_channels/${threadID}/messages/${messageID}`
    await this.http.base(url, {
      headers: { 'Session-Key': this.wsClient.sessionKey },
      method: 'DELETE',
    })
  }

  private deleteInboxMessage = async (thingID: string) => {
    const url = `${RedditURLs.API_OAUTH}/api/del_msg/`
    const payload = { id: `t4_${thingID}` }

    const headers = {
      'User-Agent': WEB_USERAGENT,
      Authorization: `Bearer ${this.apiToken}`,
    }

    await this.http.post(url, {
      cookieJar: this.cookieJar,
      headers,
      body: JSON.stringify(payload),
      searchParams: { ...payload },
    })
  }

  deleteMessage = async (threadID: string, messageID: string) => {
    if (threadID.startsWith('sendbird_')) return this.deleteSendbirdMessage(threadID, messageID)

    return this.deleteInboxMessage(messageID)
  }

  sendTyping = async (threadID: string) => {
    if (!threadID.startsWith('sendbird_')) return

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
