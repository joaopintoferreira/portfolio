import { documentSpec } from '@/lib/validation'

export const documentTable = {
  name: 'documents' as const,
  columns: ['title', 'type', 'file_url'],
  spec: documentSpec,
}
