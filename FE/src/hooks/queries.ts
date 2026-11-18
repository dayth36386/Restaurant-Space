"use client"

import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { chatApi, commentApi, restaurantApi, taxonomyApi, userApi } from "@/lib/api/endpoints"
import type { RestaurantQuery } from "@/lib/api/types"
import { useAuthStore } from "@/stores/auth-store"

export const qk = {
  feed: (q: RestaurantQuery) => ["feed", q] as const,
  restaurants: (q: RestaurantQuery) => ["restaurants", q] as const,
  restaurant: (id: string) => ["restaurant", id] as const,
  me: ["me"] as const,
  user: (username: string) => ["user", username] as const,
  categories: ["categories"] as const,
  tags: ["tags"] as const,
  comments: (restaurantId: string) => ["comments", restaurantId] as const,
  conversations: ["conversations"] as const,
  conversation: (id: string) => ["conversation", id] as const,
  messages: (id: string) => ["messages", id] as const,
}

/** Wait for the initial session refresh so requests carry the right identity. */
function useSessionReady() {
  return useAuthStore((s) => s.status !== "loading")
}

const PAGE_SIZE = 20

export function useFeed(query: Omit<RestaurantQuery, "cursor">) {
  const ready = useSessionReady()
  return useInfiniteQuery({
    queryKey: qk.feed(query),
    queryFn: ({ pageParam }) => restaurantApi.feed({ limit: PAGE_SIZE, ...query, cursor: pageParam || undefined }),
    initialPageParam: "",
    getNextPageParam: (last) => last.next_cursor || undefined,
    enabled: ready,
  })
}

export function useRestaurants(query: Omit<RestaurantQuery, "cursor">, enabled = true) {
  const ready = useSessionReady()
  return useInfiniteQuery({
    queryKey: qk.restaurants(query),
    queryFn: ({ pageParam }) => restaurantApi.list({ limit: PAGE_SIZE, ...query, cursor: pageParam || undefined }),
    initialPageParam: "",
    getNextPageParam: (last) => last.next_cursor || undefined,
    enabled: ready && enabled,
  })
}

export function useRestaurant(id: string) {
  const ready = useSessionReady()
  return useQuery({
    queryKey: qk.restaurant(id),
    queryFn: () => restaurantApi.detail(id),
    enabled: ready && !!id,
    // Image URLs are presigned for 5 minutes; refetch before they expire.
    staleTime: 60_000,
    refetchInterval: 4 * 60_000,
  })
}

export function useMyProfile() {
  const authed = useAuthStore((s) => s.status === "authenticated")
  return useQuery({ queryKey: qk.me, queryFn: userApi.me, enabled: authed, staleTime: 60_000, refetchInterval: 4 * 60_000 })
}

export function usePublicProfile(username: string) {
  const ready = useSessionReady()
  return useQuery({ queryKey: qk.user(username), queryFn: () => userApi.byUsername(username), enabled: ready })
}

export function useCategories() {
  return useQuery({ queryKey: qk.categories, queryFn: taxonomyApi.categories, staleTime: 10 * 60_000, select: (d) => d.items })
}

export function useTags() {
  return useQuery({ queryKey: qk.tags, queryFn: taxonomyApi.tags, staleTime: 10 * 60_000, select: (d) => d.items })
}

export function useComments(restaurantId: string) {
  const ready = useSessionReady()
  return useInfiniteQuery({
    queryKey: qk.comments(restaurantId),
    queryFn: ({ pageParam }) => commentApi.list(restaurantId, pageParam || undefined),
    initialPageParam: "",
    getNextPageParam: (last) => last.next_cursor || undefined,
    enabled: ready,
  })
}

function useAuthed() {
  return useAuthStore((s) => s.status === "authenticated")
}

export function useConversations() {
  return useQuery({ queryKey: qk.conversations, queryFn: chatApi.list, enabled: useAuthed(), staleTime: 15_000 })
}

export function useConversation(id: string) {
  return useQuery({ queryKey: qk.conversation(id), queryFn: () => chatApi.detail(id), enabled: useAuthed() && !!id })
}

export function useMessages(id: string) {
  return useInfiniteQuery({
    queryKey: qk.messages(id),
    queryFn: ({ pageParam }) => chatApi.messages(id, pageParam || undefined),
    initialPageParam: "",
    getNextPageParam: (last) => last.next_cursor || undefined,
    enabled: useAuthed() && !!id,
    // Live updates arrive over the socket; refetch only on reconnect.
    staleTime: Infinity,
  })
}
