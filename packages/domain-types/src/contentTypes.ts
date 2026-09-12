/** Link fields shared by navigation and related-content UI. */
export interface UiContentBaseRecord {
  readonly url: string;
  readonly title: string;
}

/** Exact metadata consumed by menu, header, and breadcrumb UI. */
export interface UiNavigationContentRecord extends UiContentBaseRecord {
  readonly rawUrl?: string;
  readonly footerNav?: boolean;
  readonly nav?: boolean;
  readonly menuIcon?: string;
}

/** Exact metadata consumed by article-card UI. */
export interface UiContentCardRecord extends UiContentBaseRecord {
  readonly description: string;
  readonly publishDate: string;
  readonly image: string;
  readonly srcset?: string;
  readonly slug?: string;
  readonly summary?: string;
}

/** Exact metadata consumed by full blog-page UI. */
export interface UiBlogContentRecord extends UiContentCardRecord {
  readonly subTitle?: string;
  readonly updateDate?: string;
  readonly tags?: readonly string[];
  readonly layout?: string;
}

/** Exact metadata consumed when rendering a blog author. */
export interface UiAuthorContentRecord extends UiContentBaseRecord {
  readonly image: string;
  readonly srcset?: string;
}
