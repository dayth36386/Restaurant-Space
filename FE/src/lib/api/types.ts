// Typed mirror of BE/docs/openapi.json (components.schemas).

export type Role = "USER" | "ADMIN"
export type VisitStatus = "WANT_TO_GO" | "VISITED"
export type Visibility = "PUBLIC" | "PRIVATE"

export interface ApiErrorBody {
  error: { code: string; message: string }
}

export interface UserPreferences {
  locale?: "th" | "en"
  default_visibility?: Visibility
  [key: string]: unknown
}

export interface User {
  id: string
  email: string
  username: string
  display_name: string
  bio?: string | null
  role: Role
  status: "ACTIVE" | "SUSPENDED"
  preferences?: UserPreferences | null
  created_at?: string
  updated_at?: string
}

export interface Tokens {
  access_token: string
  token_type: "Bearer"
  expires_in: number
  user: User
}

export interface RegisterInput {
  email: string
  password: string
  username: string
  display_name: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface ProfileImages {
  avatar_url?: string | null
  cover_url?: string | null
}

export interface MyProfile {
  user: User
  images: ProfileImages
}

export interface PublicProfile {
  id: string
  username: string
  display_name: string
  bio?: string | null
  images?: ProfileImages
  public_restaurant_count: number
}

export interface ProfilePatch {
  username?: string
  display_name?: string
  bio?: string | null
  preferences?: UserPreferences | null
  avatar_media_id?: string | null
  cover_media_id?: string | null
}

export interface RestaurantFields {
  name: string
  description?: string | null
  address?: string | null
  phone?: string | null
  website_url?: string | null
  latitude?: number | null
  longitude?: number | null
  map_url?: string | null
  map_embed_url?: string | null
  price_min?: number | null
  price_max?: number | null
  currency?: "THB"
  visit_status?: VisitStatus
  visibility?: Visibility
}

export interface RestaurantCreate extends RestaurantFields {
  category_ids?: string[]
  tag_ids?: string[]
}

export type RestaurantPatch = Partial<RestaurantCreate>

export interface Restaurant extends RestaurantFields {
  id: string
  user_id: string
  visit_status: VisitStatus
  visibility: Visibility
  created_at: string
  updated_at: string
}

export interface Taxonomy {
  id: string
  name: string
  slug: string
}

export interface TaxonomyList {
  items: Taxonomy[]
}

export interface RestaurantCard {
  restaurant: Restaurant
  /** User who posted the recommendation. */
  author: UserSummary
  cover_url: string | null
  like_count: number
  comment_count: number
}

export interface RestaurantList {
  items: RestaurantCard[]
  /** Empty string when there are no more results. */
  next_cursor: string
}

export interface Media {
  id: string
  owner_id: string
  mime_type: "image/jpeg"
  size_bytes: number
  width: number
  height: number
  status: "PENDING" | "READY" | "DELETING"
}

export interface UploadResult {
  media: Media
  url: string
  expires_in: number
}

export interface RestaurantImage {
  id: string
  restaurant_id: string
  media_id: string
  alt_text?: string | null
  sort_order: number
  is_cover: boolean
  created_at?: string
}

export interface ImageWithURL {
  image: RestaurantImage
  url: string
}

export interface ImagePatch {
  alt_text?: string | null
  sort_order?: number
  is_cover?: boolean
}

export interface MenuInput {
  name: string
  description?: string | null
  price?: number | null
  image_media_id?: string | null
  sort_order?: number
}

export interface Menu extends MenuInput {
  id: string
  restaurant_id: string
  sort_order: number
}

export interface MenuWithURL {
  menu: Menu
  /** Empty when there is no photo. */
  image_url: string
}

export interface RestaurantDetail extends RestaurantCard {
  images: ImageWithURL[]
  menus: MenuWithURL[]
  categories: Taxonomy[]
  tags: Taxonomy[]
  /** Whether the caller likes it; false for guests. */
  liked: boolean
}

export interface UserSummary {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  /** Conversation views only. */
  online?: boolean
}

export interface Reply {
  id: string
  restaurant_id: string
  parent_id: string | null
  /** null when deleted */
  content: string | null
  deleted: boolean
  edited: boolean
  author: UserSummary | null
  created_at: string
  updated_at: string
}

export interface Comment extends Reply {
  replies: Reply[]
}

export interface CommentList {
  items: Comment[]
  next_cursor: string
}

export interface LikeState {
  liked: boolean
  like_count: number
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  client_message_id: string
  kind: "TEXT" | "RESTAURANT"
  content: string | null
  /** Shared restaurant while still visible to the viewer. */
  restaurant: RestaurantCard | null
  created_at: string
}

export interface MessageList {
  /** Newest first. */
  items: ChatMessage[]
  next_cursor: string
}

export interface Conversation {
  id: string
  other_user: UserSummary
  last_message: ChatMessage | null
  unread_count: number
  other_last_read_message_id: string | null
  created_at: string
  updated_at: string
}

export interface ConversationList {
  items: Conversation[]
}

export interface SendMessageInput {
  client_message_id: string
  content?: string
  restaurant_id?: string
}

export interface RestaurantQuery {
  limit?: number
  cursor?: string
  q?: string
  mine?: boolean
  user_id?: string
  visit_status?: VisitStatus
  category_id?: string
}
