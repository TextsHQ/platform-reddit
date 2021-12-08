import { Message, MessageContent, OnServerEventCallback, ServerEventType } from '@textshq/platform-sdk/'
import WebSocket from 'ws'

import type Store from './store'
import { SENDBIRD_KEY, SENDBIRD_USER_AGENT, USER_AGENT } from './constants'
import { mapMessage } from '../mappers'

class RealTime {
  store: Store

  private ws?: WebSocket

  sessionKey: string

  reqId: number = new Date().getTime()

  onEvent: OnServerEventCallback

  userId: string

  sendMessageResolvers = new Map<string, Function>()

  constructor(onEvent: OnServerEventCallback, store: Store) {
    this.onEvent = onEvent
    this.store = store
  }

  getWsUrl = (userId: string, apiToken: string): string => {
    const base = 'wss://sendbirdproxyk8s.chat.redditmedia.com'
    const params = {
      user_id: `t2_${userId}`,
      access_token: apiToken,
      p: 'Android',
      pv: '30',
      sv: '3.0.144',
      ai: SENDBIRD_KEY,
      'SB-User-Agent': SENDBIRD_USER_AGENT,
      active: '1',
    }

    return `${base}/?${new URLSearchParams(params).toString()}`
  }

  connect = async ({ userId, apiToken }) => {
    if (this.ws?.readyState === WebSocket.CONNECTING || this.ws?.readyState === WebSocket.OPEN) return

    this.userId = `t2_${userId}`
    const url = this.getWsUrl(userId, apiToken)
    this.ws = new WebSocket(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Encoding': 'gzip',
      },
    })

    this.setupHandlers()
  }

  private setupHandlers = () => {
    this.ws.on('open', async () => console.log('HELLO CONNECTED'))

    this.ws.on('error', error => console.log('EEERRORRRR', error))

    this.ws.onmessage = this.onMessage
  }

  onMessage = (message: WebSocket.MessageEvent) => {
    // Structure:
    // IDEN:data
    // Example: LOGI{"key":"blablabla"}
    const dataString = (message.data as string).slice(4)
    // FIXME: add more cases
    const data = JSON.parse(dataString)
    const type = message.data.slice(0, 4)
    // TODO: Use types
    if (type === 'LOGI') this.handleLOGIEvent(data)
    if (type === 'MESG' || type === 'MEDI') this.handleMESGEvent(data)
  }

  handleLOGIEvent = (data: Record<string, any>) => {
    this.sessionKey = data.key
  }

  handleMESGEvent = (data: Record<string, any>) => {
    const messageData = JSON.parse(data?.data || '{}')
    const resolve = this.sendMessageResolvers.get(data?.request_id) || this.store.getPromise(messageData?.v1?.clientMessageId)

    if (resolve) {
      this.sendMessageResolvers.delete(data?.request_id)
      this.store.deletePromise(messageData?.v1?.clientMessageId)

      resolve([mapMessage(data, this.userId)])
      return true
    }

    this.onEvent([{
      type: ServerEventType.STATE_SYNC,
      objectIDs: { threadID: data?.channel_url },
      objectName: 'message',
      mutationType: 'upsert',
      entries: [mapMessage(data, this.userId)],
    }])
  }

  sendMessage = async (threadID: string, content: MessageContent): Promise<Message[]> => {
    if (!content.text) return []
    // Example: MESG{"channel_url":"sendbird_group_channel_16439928_db598c59987a33d2a179c445bee680c803b52097","message":"testing","data":"{\\"v1\\":{\\"preview_collapsed\\":false,\\"embed_data\\":{},\\"hidden\\":false,\\"highlights\\":[],\\"message_body\\":\\"testing\\"}}","mention_type":"users","req_id":"1637935556054"}\n
    const payload = `MESG{"channel_url":"${threadID}","message":"${content.text}","data":"{\\"v1\\":{\\"preview_collapsed\\":false,\\"embed_data\\":{},\\"hidden\\":false,\\"highlights\\":[],\\"message_body\\":\\"${content.text}\\"}}","mention_type":"users","req_id":"${this.reqId}"}\n`
    this.ws.send(payload)

    const promise = new Promise<any>(resolve => {
      this.sendMessageResolvers.set(`${this.reqId}`, resolve)
    })

    this.reqId += 1
    return promise
  }

  sendTyping = async (threadID: string) => {
    const time = new Date().getTime()
    const payload = `TPST{{"channel_url":"${threadID}","time":${time},"req_id":""}}\n`
    this.ws.send(payload)
  }
}

export default RealTime
