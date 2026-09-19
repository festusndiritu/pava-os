'use client';

import type { SaleDocument } from '../../lib/documents-api';
import { DocumentSheet } from './DocumentSheet';

export function DocumentLetterhead({ doc }: { doc: SaleDocument }) {
  return <DocumentSheet doc={doc} />;
}