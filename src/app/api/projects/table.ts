import { projectSpec } from '@/lib/validation'

export const projectTable = {
  name: 'projects' as const,
  columns: ['title', 'description', 'long_description', 'tags', 'image_url', 'gallery_urls', 'demo_url', 'repo_url', 'doc_url', 'category', 'featured'],
  spec: projectSpec,
}
