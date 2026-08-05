import type { StorageFolder, StorageFile } from '../types'

export const storageFolders: StorageFolder[] = [
  { id: 'documents', name: 'Documents', parentId: null },
  { id: 'photos', name: 'Photos', parentId: null },
  { id: 'work', name: 'Work Files', parentId: null },
  { id: 'documents-contracts', name: 'Contracts', parentId: 'documents' },
  { id: 'documents-receipts', name: 'Receipts', parentId: 'documents' },
  { id: 'photos-trip', name: 'Bali Trip 2026', parentId: 'photos' },
  { id: 'work-clients', name: 'Clients', parentId: 'work' },
  { id: 'work-clients-acme', name: 'Acme Corp', parentId: 'work-clients' },
]

export const storageFiles: StorageFile[] = [
  { id: 'f1', name: 'Resume.pdf', parentId: null, type: 'pdf', sizeBytes: 190464, modifiedAt: '2026-07-28' },
  { id: 'f2', name: 'Cover Letter.doc', parentId: null, type: 'doc', sizeBytes: 43008, modifiedAt: '2026-07-28' },
  { id: 'f3', name: 'Lease Agreement.pdf', parentId: 'documents-contracts', type: 'pdf', sizeBytes: 1258291, modifiedAt: '2026-06-03' },
  { id: 'f4', name: 'Freelance Contract.pdf', parentId: 'documents-contracts', type: 'pdf', sizeBytes: 911360, modifiedAt: '2026-05-14' },
  { id: 'f5', name: 'July Groceries.pdf', parentId: 'documents-receipts', type: 'pdf', sizeBytes: 112640, modifiedAt: '2026-08-01' },
  { id: 'f6', name: 'Electricity Bill.pdf', parentId: 'documents-receipts', type: 'pdf', sizeBytes: 97280, modifiedAt: '2026-07-30' },
  { id: 'f7', name: 'Sunset Beach.jpg', parentId: 'photos-trip', type: 'image', sizeBytes: 4299162, modifiedAt: '2026-07-20' },
  { id: 'f8', name: 'Rice Terrace.jpg', parentId: 'photos-trip', type: 'image', sizeBytes: 3984589, modifiedAt: '2026-07-21' },
  { id: 'f9', name: 'Team Photo.jpg', parentId: 'photos', type: 'image', sizeBytes: 2726298, modifiedAt: '2026-06-10' },
  { id: 'f10', name: 'Q3 Budget.sheet', parentId: 'work', type: 'sheet', sizeBytes: 59392, modifiedAt: '2026-08-02' },
  { id: 'f11', name: 'Brand Assets.zip', parentId: 'work', type: 'zip', sizeBytes: 19293798, modifiedAt: '2026-07-05' },
  { id: 'f12', name: 'Proposal.doc', parentId: 'work-clients-acme', type: 'doc', sizeBytes: 215040, modifiedAt: '2026-08-03' },
  { id: 'f13', name: 'Invoice-0042.pdf', parentId: 'work-clients-acme', type: 'pdf', sizeBytes: 78848, modifiedAt: '2026-08-03' },
  { id: 'f14', name: 'Notes.txt', parentId: 'work-clients', type: 'other', sizeBytes: 3072, modifiedAt: '2026-07-29' },
]
