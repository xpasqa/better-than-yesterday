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
  { id: 'f1', name: 'Resume.pdf', parentId: null, type: 'pdf', size: '186 KB', modifiedAt: 'Jul 28' },
  { id: 'f2', name: 'Cover Letter.doc', parentId: null, type: 'doc', size: '42 KB', modifiedAt: 'Jul 28' },
  { id: 'f3', name: 'Lease Agreement.pdf', parentId: 'documents-contracts', type: 'pdf', size: '1.2 MB', modifiedAt: 'Jun 3' },
  { id: 'f4', name: 'Freelance Contract.pdf', parentId: 'documents-contracts', type: 'pdf', size: '890 KB', modifiedAt: 'May 14' },
  { id: 'f5', name: 'July Groceries.pdf', parentId: 'documents-receipts', type: 'pdf', size: '110 KB', modifiedAt: 'Aug 1' },
  { id: 'f6', name: 'Electricity Bill.pdf', parentId: 'documents-receipts', type: 'pdf', size: '95 KB', modifiedAt: 'Jul 30' },
  { id: 'f7', name: 'Sunset Beach.jpg', parentId: 'photos-trip', type: 'image', size: '4.1 MB', modifiedAt: 'Jul 20' },
  { id: 'f8', name: 'Rice Terrace.jpg', parentId: 'photos-trip', type: 'image', size: '3.8 MB', modifiedAt: 'Jul 21' },
  { id: 'f9', name: 'Team Photo.jpg', parentId: 'photos', type: 'image', size: '2.6 MB', modifiedAt: 'Jun 10' },
  { id: 'f10', name: 'Q3 Budget.sheet', parentId: 'work', type: 'sheet', size: '58 KB', modifiedAt: 'Aug 2' },
  { id: 'f11', name: 'Brand Assets.zip', parentId: 'work', type: 'zip', size: '18.4 MB', modifiedAt: 'Jul 5' },
  { id: 'f12', name: 'Proposal.doc', parentId: 'work-clients-acme', type: 'doc', size: '210 KB', modifiedAt: 'Aug 3' },
  { id: 'f13', name: 'Invoice-0042.pdf', parentId: 'work-clients-acme', type: 'pdf', size: '77 KB', modifiedAt: 'Aug 3' },
  { id: 'f14', name: 'Notes.txt', parentId: 'work-clients', type: 'other', size: '3 KB', modifiedAt: 'Jul 29' },
]
