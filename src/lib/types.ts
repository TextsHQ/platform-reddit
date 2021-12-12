// @see https://github.com/aelesia/npm-reddit-ts/blob/master/src/types/MeResult.type.ts

export type MeResult = {
  is_employee: boolean
  seen_layout_switch: boolean
  has_visited_new_profile: boolean
  pref_no_profanity: boolean
  has_external_account: boolean
  pref_geopopular: string
  seen_redesign_modal: boolean
  pref_show_trending: boolean
  subreddit: Subreddit
  is_sponsor: boolean
  gold_expiration: null
  has_gold_subscription: boolean
  num_friends: number
  features: Features
  has_android_subscription: boolean
  verified: boolean
  new_modmail_exists: null
  pref_autoplay: boolean
  coins: number
  has_paypal_subscription: boolean
  has_subscribed_to_premium: boolean
  id: string
  has_stripe_subscription: boolean
  seen_premium_adblock_modal: boolean
  can_create_subreddit: boolean
  over_18: boolean
  is_gold: boolean
  is_mod: boolean
  suspension_expiration_utc: null
  has_verified_email: boolean
  is_suspended: boolean
  pref_video_autoplay: boolean
  in_chat: boolean
  in_redesign_beta: boolean
  icon_img: string
  has_mod_mail: boolean
  pref_nightmode: boolean
  oauth_client_id: string
  hide_from_robots: boolean
  link_karma: number
  force_password_reset: boolean
  seen_give_award_tooltip: boolean
  inbox_count: number
  pref_top_karma_subreddits: boolean
  has_mail: boolean
  pref_show_snoovatar: boolean
  name: string
  pref_clickgadget: number
  created: number
  gold_creddits: number
  created_utc: number
  has_ios_subscription: boolean
  pref_show_twitter: boolean
  in_beta: boolean
  comment_karma: number
  has_subscribed: boolean
  seen_subreddit_chat_ftux: boolean
}

type Features = {
  promoted_trend_blanks: boolean
  show_amp_link: boolean
  chat: boolean
  twitter_embed: boolean
  is_email_permission_required: boolean
  chat_subreddit_notification_ftux: boolean
  mod_awards: boolean
  mweb_xpromo_revamp_v3: Mweb
  mweb_xpromo_revamp_v2: Mweb
  awards_on_streams: boolean
  mweb_xpromo_modal_listing_click_daily_dismissible_ios: boolean
  community_awards: boolean
  modlog_copyright_removal: boolean
  do_not_track: boolean
  chat_user_settings: boolean
  mweb_xpromo_interstitial_comments_ios: boolean
  chat_subreddit: boolean
  mweb_link_tab: Mweb
  premium_subscriptions_table: boolean
  mweb_xpromo_interstitial_comments_android: boolean
  mweb_xpromo_modal_listing_click_daily_dismissible_android: boolean
  delete_vod_when_post_is_deleted: boolean
  awarder_names: boolean
  chat_group_rollout: boolean
  custom_feeds: boolean
  spez_modal: boolean
  mweb_sharing_clipboard: Mweb
  expensive_coins_package: boolean
}

type Mweb = {
  owner: string
  variant: string
  experiment_id: number
}

type Subreddit = {
  default_set: boolean
  user_is_contributor: boolean
  banner_img: string
  restrict_posting: boolean
  user_is_banned: boolean
  free_form_reports: boolean
  community_icon: string
  show_media: boolean
  icon_color: string
  user_is_muted: boolean
  display_name: string
  header_img: null
  title: string
  coins: number
  over_18: boolean
  icon_size: number[]
  primary_color: string
  icon_img: string
  description: string
  submit_link_label: string
  header_size: null
  restrict_commenting: boolean
  subscribers: number
  submit_text_label: string
  is_default_icon: boolean
  link_flair_position: string
  display_name_prefixed: string
  key_color: string
  name: string
  is_default_banner: boolean
  url: string
  banner_size: null
  user_is_moderator: boolean
  public_description: string
  link_flair_enabled: boolean
  disable_contributor_requests: boolean
  subreddit_type: string
  user_is_subscriber: boolean
}

export type Reaction = {
  updated_at: number
  key: string
  user_ids: string[]
}
