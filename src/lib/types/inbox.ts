import type { MeResult } from '.'

export interface InboxResponse {
  kind: string
  data: InboxResponseData
}

export interface InboxResponseData {
  after: null | string
  dist: null | string
  modhash: string
  geo_filter: string
  children: InboxChild[]
  before: null
}

export interface InboxChild {
  kind: string
  data: InboxData
}

export interface InboxData {
  first_message: null
  first_message_name: null
  subreddit: null
  likes: null
  replies: RepliesClass | string
  author_fullname: null | string
  id: string
  subject: string
  associated_awarding_id: null
  score: number
  author: string
  num_comments: null
  parent_id: null
  subreddit_name_prefixed: null
  new: boolean
  type: string
  body: string
  dest: string
  was_comment: boolean
  body_html: string
  name: string
  created: number
  created_utc: number
  context: string
  distinguished: null | string
  participants?: MeResult[]
}

export interface RepliesClass {
  kind: string
  data: RepliesData
}

export interface RepliesData {
  after: null
  dist: null
  modhash: string
  geo_filter: string
  children: ReplyChild[]
  before: null
}

export interface ReplyChild {
  kind: string
  data: ReplyData
}

export interface ReplyData {
  first_message: number
  first_message_name: string
  subreddit: null
  likes: null
  replies: string
  author_fullname: string
  id: string
  subject: string
  associated_awarding_id: null
  score: number
  author: string
  num_comments: null
  parent_id: string
  subreddit_name_prefixed: null
  new: boolean
  type: string
  body: string
  dest: string
  was_comment: boolean
  body_html: string
  name: string
  created: number
  created_utc: number
  context: string
  distinguished: null
}
