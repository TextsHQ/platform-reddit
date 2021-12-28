import type { SupportedReaction } from '@textshq/platform-sdk'

export const MOBILE_USERAGENT = 'Reddit/Version 2021.20.0/Build 326964/Android 11'
export const WEB_USERAGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:85.0) Gecko/20100101 Firefox/85.0'
export const OAUTH_CLIENT_ID_B64 = 'b2hYcG9xclpZdWIxa2c6'
export const USER_AGENT = 'Jand/3.0.144'

export const SENDBIRD_USER_AGENT = 'Android%2Fc3.0.144'
export const SENDBIRD_KEY = '2515BDA8-9D3A-47CF-9325-330BC37ADA13'

export const RedditURLs = {
  HOME: 'https://reddit.com',
  HOME_OLD: 'https://old.reddit.com',
  HOME_NEW: 'https://new.reddit.com',
  SNOOMOJI_STATIC: 'https://www.redditstatic.com/desktop2x/img/snoomoji',
  API_I: 'https://i.redd.it',
  API_ACCOUNTS: 'https://accounts.reddit.com',
  API_OAUTH: 'https://oauth.reddit.com',
  API_S: 'https://s.reddit.com',
  API_GRAPHQL: 'https://gql.reddit.com',
  SENDBIRD_PROXY: 'https://sendbirdproxyk8s.chat.redditmedia.com',
}

export const supportedReactions: Record<string, SupportedReaction> = {
  '8r21ukpfa7081.gif': { title: 'care', imgURL: `${RedditURLs.API_I}/8r21ukpfa7081.gif` },
  '2o3aooqfa7081.gif': { title: 'wave', imgURL: `${RedditURLs.API_I}/2o3aooqfa7081.gif` },
  'ytv3x0sfa7081.png': { title: 'doge', imgURL: `${RedditURLs.API_I}/ytv3x0sfa7081.png` },
  'mag7v6tfa7081.gif': { title: 'cry', imgURL: `${RedditURLs.API_I}/mag7v6tfa7081.gif` },
  'iuqmp7ufa7081.gif': { title: 'disapproval', imgURL: `${RedditURLs.API_I}/iuqmp7ufa7081.gif` },
  'zn7iubvfa7081.gif': { title: 'dizzy_face', imgURL: `${RedditURLs.API_I}/zn7iubvfa7081.gif` },
  'vq7naqwfa7081.gif': { title: 'downvote', imgURL: `${RedditURLs.API_I}/vq7naqwfa7081.gif` },
  'qzl5vyxfa7081.gif': { title: 'faceplam', imgURL: `${RedditURLs.API_I}/qzl5vyxfa7081.gif` },
  'mi2jolzfa7081.gif': { title: 'feels_bad_man', imgURL: `${RedditURLs.API_I}/mi2jolzfa7081.gif` },
  'k7ry7t1ga7081.gif': { title: 'feels_good_man', imgURL: `${RedditURLs.API_I}/k7ry7t1ga7081.gif` },
  'tspuf53ga7081.gif': { title: 'flip_out', imgURL: `${RedditURLs.API_I}/tspuf53ga7081.gif` },
  'evwks24ga7081.gif': { title: 'flushed', imgURL: `${RedditURLs.API_I}/evwks24ga7081.gif` },
  'dfxygs4ga7081.gif': { title: 'give_upvote', imgURL: `${RedditURLs.API_I}/dfxygs4ga7081.gif` },
  'ax7wu47ga7081.gif': { title: 'grimacing', imgURL: `${RedditURLs.API_I}/ax7wu47ga7081.gif` },
  'uy83aa8ga7081.gif': { title: 'grin', imgURL: `${RedditURLs.API_I}/uy83aa8ga7081.gif` },
  't2r5xc9ga7081.gif': { title: 'heart_eyes', imgURL: `${RedditURLs.API_I}/t2r5xc9ga7081.gif` },
  'sjs1a2fyt7081.gif': { title: 'heart_eyes_rainbow', imgURL: `${RedditURLs.API_I}/sjs1a2fyt7081.gif` },
  'ksz4fmaga7081.gif': { title: 'hug', imgURL: `${RedditURLs.API_I}/ksz4fmaga7081.gif` },
  'jvuspmbga7081.gif': { title: 'joy', imgURL: `${RedditURLs.API_I}/jvuspmbga7081.gif` },
  'mp9zclcga7081.gif': { title: 'kissing_heart', imgURL: `${RedditURLs.API_I}/mp9zclcga7081.gif` },
  '9ut7iedga7081.gif': { title: 'laughing', imgURL: `${RedditURLs.API_I}/9ut7iedga7081.gif` },
  'ul2w17ega7081.gif': { title: 'money_face', imgURL: `${RedditURLs.API_I}/ul2w17ega7081.gif` },
  '0ku6twega7081.gif': { title: 'neutral_face', imgURL: `${RedditURLs.API_I}/0ku6twega7081.gif` },
  'cdnhvqfga7081.gif': { title: 'no_mouth', imgURL: `${RedditURLs.API_I}/cdnhvqfga7081.gif` },
  '1p1jgpgga7081.gif': { title: 'poop', imgURL: `${RedditURLs.API_I}/1p1jgpgga7081.gif` },
  'b5s6cohga7081.gif': { title: 'put_back', imgURL: `${RedditURLs.API_I}/b5s6cohga7081.gif` },
  'av9z8iiga7081.gif': { title: 'rage', imgURL: `${RedditURLs.API_I}/av9z8iiga7081.gif` },
  '00brcfjga7081.gif': { title: 'scream', imgURL: `${RedditURLs.API_I}/00brcfjga7081.gif` },
  'pleyoikga7081.gif': { title: 'shrug', imgURL: `${RedditURLs.API_I}/pleyoikga7081.gif` },
  'm7uy86lga7081.gif': { title: 'sleep', imgURL: `${RedditURLs.API_I}/m7uy86lga7081.gif` },
  '8kw138jyt7081.gif': { title: 'slightly_smiling', imgURL: `${RedditURLs.API_I}/8kw138jyt7081.gif` },
  'wbrgz1nga7081.gif': { title: 'smile', imgURL: `${RedditURLs.API_I}/wbrgz1nga7081.gif` },
  'fsg2a1oga7081.gif': { title: 'snoo', imgURL: `${RedditURLs.API_I}/fsg2a1oga7081.gif` },
  '8zx5ixoga7081.gif': { title: 'sob', imgURL: `${RedditURLs.API_I}/8zx5ixoga7081.gif` },
  't5bqwxdyt7081.gif': { title: 'stuck_out_tongue', imgURL: `${RedditURLs.API_I}/t5bqwxdyt7081.gif` },
  'xjls1pqga7081.gif': { title: 'sunglasses', imgURL: `${RedditURLs.API_I}/xjls1pqga7081.gif` },
  '7rc03trga7081.gif': { title: 'surprise', imgURL: `${RedditURLs.API_I}/7rc03trga7081.gif` },
  'd45pfmsga7081.gif': { title: 'sweat', imgURL: `${RedditURLs.API_I}/d45pfmsga7081.gif` },
  'g6akcitga7081.gif': { title: 'sweat_smile', imgURL: `${RedditURLs.API_I}/g6akcitga7081.gif` },
  't1djdguga7081.gif': { title: 'table', imgURL: `${RedditURLs.API_I}/t1djdguga7081.gif` },
  '19b5q4vga7081.gif': { title: 'table_flip', imgURL: `${RedditURLs.API_I}/19b5q4vga7081.gif` },
  '4zhlw4iyt7081.gif': { title: 'thinking_face_hmm', imgURL: `${RedditURLs.API_I}/4zhlw4iyt7081.gif` },
  '3s0glewga7081.gif': { title: 'thumbs_down', imgURL: `${RedditURLs.API_I}/3s0glewga7081.gif` },
  '7url39xga7081.gif': { title: 'thumbs_up', imgURL: `${RedditURLs.API_I}/7url39xga7081.gif` },
  'd2kn6yxga7081.gif': { title: 'trollface', imgURL: `${RedditURLs.API_I}/d2kn6yxga7081.gif` },
  'foyijyyga7081.gif': { title: 'upvote', imgURL: `${RedditURLs.API_I}/foyijyyga7081.gif` },
  '3i2arwzga7081.gif': { title: 'wink', imgURL: `${RedditURLs.API_I}/3i2arwzga7081.gif` },
  '79opsq0ha7081.gif': { title: 'yummy', imgURL: `${RedditURLs.API_I}/79opsq0ha7081.gif` },
}
