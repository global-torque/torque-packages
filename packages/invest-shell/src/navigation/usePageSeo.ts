import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';

export interface IPageData {
  seo_description?: string;
  seo_title: string;
  canonical?: string;
}

interface ITagItem {
  content: string;
  name?: string;
  property?: string;
}

export function setHSPageView(path: string) {
  if (typeof window === 'undefined') return;

  const w = window as any;
  const _hsq = (w._hsq = w._hsq || []);
  _hsq.push(['setPath', path]);
  _hsq.push(['trackPageView']);
}

export const usePageSeo = () => {
  const isClient = typeof window !== 'undefined' && typeof document !== 'undefined';

  function setMetaContent(key: string, meta: ITagItem) {
    if (!isClient) return;

    const selectorKey = meta.name ?? meta.property;
    if (!selectorKey) return;

    const element = document.head.querySelector<HTMLMetaElement>(`meta[${key}="${selectorKey}"]`);
    if (element) {
      element.content = meta.content;
    }
  }

  function setTitle(pageData: IPageData) {
    if (!isClient) return;

    const newTitle = pageData?.seo_title || useInvestApplicationContext().appConfig.brand.title;
    document.title = newTitle;
    const ogTitle = { property: 'og:title', content: document.title };

    setMetaContent('property', ogTitle);
    setHSPageView(window.location.pathname);
  }

  function setRobotsAll() {
    if (!isClient) return;

    const element = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (element) {
      element.content = 'noindex, nofollow';
      return;
    }

    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
  }

  // function setOgImage(pageData: IPageData) {
  //   // const url = pageData?.thumbnail?.coverage?.url || `${seo.defaultImage}`;
  //   const url = `${seo.defaultImage}`;
  //   const ogImage = { property: 'og:image', content: url };

  //   setMetaContent('property', ogImage);
  // }

  function setUrl(pageData: IPageData) {
    if (!isClient) return;

    const frontendUrl = useInvestApplicationContext().appConfig.urls.frontend ?? '';
    let canonical = pageData?.canonical;
    if (canonical && !canonical.includes('http')) {
      canonical = `${frontendUrl}${canonical}`;
    }
    const path = canonical || `${frontendUrl}${window.location.pathname}`;
    const ogUrl = { property: 'og:url', content: path };

    // set canonical url
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = path;

    // set og:url
    setMetaContent('property', ogUrl);
  }

  function setMetaTags(pageData: IPageData) {
    const description = pageData?.seo_description
      || useInvestApplicationContext().appConfig.brand.description;
    const seoTags: ITagItem[] = [
      {
        name: 'description',
        content: description,
      },
      {
        property: 'og:description',
        content: description,
      },
    ];

    seoTags.forEach((singleTag) => {
      Object.keys(singleTag).forEach((key) => {
        setMetaContent(key, singleTag);
      });
    });
  }

  function setMetaData(pageData: IPageData) {
    setTitle(pageData);
    setMetaTags(pageData);
    setUrl(pageData);
  }

  return {
    setMetaContent,
    setTitle,
    setUrl,
    setMetaTags,
    setMetaData,
    setRobotsAll,
  };
};
