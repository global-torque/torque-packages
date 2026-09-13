import type {
  FilerAccess,
  FilerId,
  FilerObjectTree,
  IFilerItem,
} from '@global-torque/domain-types/filerTypes';

export interface FilerDocumentSource {
  access: FilerAccess;
  tree?: FilerObjectTree | null;
}

export interface IFilerItemFormatted extends IFilerItem {
  id: FilerId;
  key: string;
  access: FilerAccess;
  actionUrl: string;
  category: string;
  date: string;
  dateTimestamp: number | null;
  isNew: boolean;
  name: string;
  tagColor?: string;
  typeFormatted: string;
}

const MEDIA_CATEGORY = 'media';
const OTHER_CATEGORY = 'other';
const INVESTMENT_AGREEMENTS_CATEGORY = 'investment-agreements';
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

const normalizeCategory = (value: unknown): string => {
  if (typeof value !== 'string') return OTHER_CATEGORY;
  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  return normalized || OTHER_CATEGORY;
};

const capitalizeCategory = (value: string): string => value
  .split('-')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const parseDate = (value: unknown): number | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const formatDate = (timestamp: number | null): string => (
  timestamp === null ? '—' : DATE_FORMATTER.format(new Date(timestamp))
);

const isFileNode = (node: IFilerItem): boolean => (
  node.id !== undefined
  && node.type !== 'folder'
  && (!node.entities
    || typeof node.filename === 'string'
    || typeof node.original_filename === 'string'
    || typeof node.mime === 'string'
    || node.type === 'file'
    || node.type === 'link')
);

const isDerivedThumbnail = (node: IFilerItem): boolean => node.type === 'file_thumbnail';

const categoryForNode = (node: IFilerItem, inheritedCategory: string): string => {
  const explicit = node['object-type'] ?? node['object-name'];
  return explicit ? normalizeCategory(explicit) : inheritedCategory;
};

const collectRootCategories = (nodes: Record<string, IFilerItem>): string[] => (
  Object.entries(nodes).flatMap(([nodeKey, node]) => {
    const nodeCategory = categoryForNode(node, OTHER_CATEGORY);
    const ownCategory = normalizeCategory(
      node['object-type'] ?? node['object-name'] ?? node.name ?? nodeKey,
    );
    if (
      nodeCategory === MEDIA_CATEGORY
      || ownCategory === MEDIA_CATEGORY
      || isDerivedThumbnail(node)
    ) return [];

    return [isFileNode(node) ? nodeCategory : ownCategory];
  })
);

const collectFiles = (
  nodes: Record<string, IFilerItem>,
  access: FilerAccess,
  filerBaseUrl: string,
  nowMs: number,
  inheritedCategory = OTHER_CATEGORY,
): IFilerItemFormatted[] => Object.entries(nodes).flatMap(([nodeKey, node]) => {
  const nodeCategory = categoryForNode(node, inheritedCategory);
  if (nodeCategory === MEDIA_CATEGORY || isDerivedThumbnail(node)) return [];

  if (isFileNode(node)) {
    const id = node.id!;
    const name = String(node.original_filename ?? node.filename ?? node.name ?? 'Document');
    const hasCreatedAt = typeof node.created_at === 'string' && node.created_at.trim().length > 0;
    const timestamp = hasCreatedAt ? parseDate(node.created_at) : parseDate(node.updated_at);
    const ageMs = timestamp === null ? null : nowMs - timestamp;
    const category = nodeCategory;
    const baseUrl = filerBaseUrl.replace(/\/+$/, '');

    return [{
      ...node,
      id,
      key: `${access}:${String(id)}`,
      access,
      actionUrl: `${baseUrl}/${access === 'public' ? 'public' : 'auth'}/files/${encodeURIComponent(String(id))}`,
      category,
      'object-type': category,
      name,
      date: formatDate(timestamp),
      dateTimestamp: timestamp,
      isNew: ageMs !== null && ageMs >= 0 && ageMs < TWO_DAYS_MS,
      tagColor: FilerFormatter.getTagColorByType(category),
      typeFormatted: capitalizeCategory(category),
      url: undefined,
    }];
  }

  const ownFolderCategory = normalizeCategory(
    node['object-type'] ?? node['object-name'] ?? node.name ?? nodeKey,
  );
  const folderCategory = inheritedCategory === OTHER_CATEGORY
    ? ownFolderCategory
    : inheritedCategory;
  if (ownFolderCategory === MEDIA_CATEGORY || folderCategory === MEDIA_CATEGORY) return [];

  return node.entities
    ? collectFiles(node.entities, access, filerBaseUrl, nowMs, folderCategory)
    : [];
});

export class FilerFormatter {
  static getTagColorByType(objectType?: string): string | undefined {
    switch (normalizeCategory(objectType)) {
      case OTHER_CATEGORY:
        return 'is--background-purple-light';
      case INVESTMENT_AGREEMENTS_CATEGORY:
        return 'is--background-secondary-light';
      case 'company':
        return 'is--background-yellow-light';
      case 'agreement':
        return 'is--background-primary-light';
      default:
        return undefined;
    }
  }

  static getFormattedInvestmentDocuments(
    sources: FilerDocumentSource[],
    filerBaseUrl: string,
    nowMs = Date.now(),
  ): IFilerItemFormatted[] {
    const byCanonicalId = new Map<string, IFilerItemFormatted>();

    for (const source of sources) {
      if (!source.tree) continue;
      for (const item of collectFiles(source.tree.entities, source.access, filerBaseUrl, nowMs)) {
        const canonicalId = String(item.id);
        const existing = byCanonicalId.get(canonicalId);
        if (!existing || source.access === 'public') byCanonicalId.set(canonicalId, item);
      }
    }

    return [...byCanonicalId.values()].sort((left, right) => {
      const leftFirst = left.category === INVESTMENT_AGREEMENTS_CATEGORY;
      const rightFirst = right.category === INVESTMENT_AGREEMENTS_CATEGORY;
      if (leftFirst !== rightFirst) return leftFirst ? -1 : 1;
      const categoryOrder = left.typeFormatted.localeCompare(right.typeFormatted);
      if (categoryOrder !== 0) return categoryOrder;
      if (left.dateTimestamp === null && right.dateTimestamp !== null) return 1;
      if (left.dateTimestamp !== null && right.dateTimestamp === null) return -1;
      return (right.dateTimestamp ?? 0) - (left.dateTimestamp ?? 0);
    });
  }

  static getFolderedInvestmentDocuments(sources: FilerDocumentSource[]): string[] {
    const categories = new Set<string>();
    for (const source of sources) {
      if (!source.tree) continue;
      for (const category of collectRootCategories(source.tree.entities)) categories.add(category);
    }
    return [...categories].map(capitalizeCategory);
  }
}
