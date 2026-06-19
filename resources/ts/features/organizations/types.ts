export interface Organization {
  id: number
  name: string
  yandex_url: string
  average_rating: number
  ratings_count: number
  reviews_count: number
  sync_status: string
  sync_progress?: { phase?: string; saved?: number }
  address?: string | null
  phone?: string | null
  city?: { id: number; name: string } | null
  organization_type?: { id: number; name: string } | null
}

export interface Review {
  id?: number
  author_name: string
  author_avatar?: string | null
  review_date: string
  text?: string | null
  rating?: number | null
  yandex_review_id?: string
}
