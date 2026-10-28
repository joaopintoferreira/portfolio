export type Project = {
  id: string
  title: string
  description: string
  long_description?: string
  tags: string[]
  image_url?: string
  gallery_urls?: string[]
  demo_url?: string
  repo_url?: string
  doc_url?: string
  category: 'web' | 'mobile' | 'iot' | 'other'
  featured: boolean
  created_at: string
}

export type Document = {
  id: string
  title: string
  type: 'cv' | 'doc' | 'cert'
  file_url: string
  created_at: string
}
