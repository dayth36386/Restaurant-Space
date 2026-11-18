import { api } from "./client"
import type {
  ChatMessage,
  Comment,
  CommentList,
  Conversation,
  ConversationList,
  LikeState,
  MessageList,
  Reply,
  SendMessageInput,
  ImagePatch,
  LoginInput,
  Menu,
  MenuInput,
  MyProfile,
  ProfilePatch,
  PublicProfile,
  RegisterInput,
  Restaurant,
  RestaurantCreate,
  RestaurantDetail,
  RestaurantImage,
  RestaurantList,
  RestaurantPatch,
  RestaurantQuery,
  TaxonomyList,
  Tokens,
  UploadResult,
} from "./types"

export const authApi = {
  register: (body: RegisterInput) => api<Tokens>("/auth/register", { method: "POST", body, anonymous: true }),
  login: (body: LoginInput) => api<Tokens>("/auth/login", { method: "POST", body, anonymous: true }),
  logout: () => api<void>("/auth/logout", { method: "POST", anonymous: true }),
  forgotPassword: (email: string) =>
    api<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email }, anonymous: true }),
  resetPassword: (token: string, password: string) =>
    api<void>("/auth/reset-password", { method: "POST", body: { token, password }, anonymous: true }),
  googleCallback: (state: string, code: string) => api<Tokens>("/auth/google/callback", { query: { state, code }, anonymous: true }),
}

export const userApi = {
  me: () => api<MyProfile>("/users/me"),
  updateMe: (body: ProfilePatch) => api<MyProfile>("/users/me", { method: "PATCH", body }),
  byUsername: (username: string) => api<PublicProfile>(`/users/${encodeURIComponent(username)}`),
}

export const restaurantApi = {
  feed: (query: RestaurantQuery) => api<RestaurantList>("/feed", { query: { ...query } }),
  list: (query: RestaurantQuery) => api<RestaurantList>("/restaurants", { query: { ...query } }),
  detail: (id: string) => api<RestaurantDetail>(`/restaurants/${id}`),
  create: (body: RestaurantCreate) => api<Restaurant>("/restaurants", { method: "POST", body }),
  update: (id: string, body: RestaurantPatch) => api<Restaurant>(`/restaurants/${id}`, { method: "PATCH", body }),
  remove: (id: string) => api<void>(`/restaurants/${id}`, { method: "DELETE" }),

  attachImage: (id: string, body: { media_id: string; is_cover?: boolean; sort_order?: number; alt_text?: string | null }) =>
    api<RestaurantImage>(`/restaurants/${id}/images`, { method: "POST", body }),
  updateImage: (id: string, imageId: string, body: ImagePatch) =>
    api<RestaurantImage>(`/restaurants/${id}/images/${imageId}`, { method: "PATCH", body }),
  removeImage: (id: string, imageId: string) => api<void>(`/restaurants/${id}/images/${imageId}`, { method: "DELETE" }),

  createMenu: (id: string, body: MenuInput) => api<Menu>(`/restaurants/${id}/menus`, { method: "POST", body }),
  updateMenu: (id: string, menuId: string, body: Partial<MenuInput>) =>
    api<Menu>(`/restaurants/${id}/menus/${menuId}`, { method: "PATCH", body }),
  removeMenu: (id: string, menuId: string) => api<void>(`/restaurants/${id}/menus/${menuId}`, { method: "DELETE" }),
}

export const taxonomyApi = {
  categories: () => api<TaxonomyList>("/categories"),
  tags: () => api<TaxonomyList>("/tags"),
}

export const uploadApi = {
  image: (file: File) => {
    const form = new FormData()
    form.append("file", file)
    return api<UploadResult>("/uploads/images", { method: "POST", form })
  },
}

export const commentApi = {
  list: (restaurantId: string, cursor?: string) =>
    api<CommentList>(`/restaurants/${restaurantId}/comments`, { query: { limit: 20, cursor } }),
  create: (restaurantId: string, content: string, parentId?: string) =>
    api<Comment>(`/restaurants/${restaurantId}/comments`, {
      method: "POST",
      body: { content, ...(parentId ? { parent_id: parentId } : {}) },
    }),
  update: (id: string, content: string) => api<Reply>(`/comments/${id}`, { method: "PATCH", body: { content } }),
  remove: (id: string) => api<void>(`/comments/${id}`, { method: "DELETE" }),
}

export const likeApi = {
  set: (restaurantId: string, liked: boolean) =>
    api<LikeState>(`/restaurants/${restaurantId}/likes`, { method: liked ? "POST" : "DELETE" }),
}

export const chatApi = {
  list: () => api<ConversationList>("/conversations"),
  start: (target: { user_id: string } | { username: string }) => api<Conversation>("/conversations", { method: "POST", body: target }),
  detail: (id: string) => api<Conversation>(`/conversations/${id}`),
  messages: (id: string, cursor?: string) => api<MessageList>(`/conversations/${id}/messages`, { query: { limit: 30, cursor } }),
  send: (id: string, body: SendMessageInput) => api<ChatMessage>(`/conversations/${id}/messages`, { method: "POST", body }),
  read: (id: string, messageId: string) => api<void>(`/conversations/${id}/read`, { method: "POST", body: { message_id: messageId } }),
}
