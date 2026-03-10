import { SITE_NAME } from '../core/site-config.js';
import { setRobots, setSocialMetadata, setSocialScaffold } from './seo.js';

const INDEXABLE_ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
const TEMPLATE_ROBOTS = 'noindex,follow';
const DEFAULT_PAGE_SEO = Object.freeze({
    'index.html': {
        title: `${SITE_NAME} | فهرس الكتب`,
        description: 'فهرس المكتبة الأخبارية للكتب العربية مع وصول مباشر للقارئ والبحث.',
        url: '/',
        robots: INDEXABLE_ROBOTS,
        ogType: 'website'
    },
    'authors.html': {
        title: `المؤلفون | ${SITE_NAME}`,
        description: `قائمة المؤلفين المتاحة في ${SITE_NAME} اعتمادًا على بيانات books/list.json.`,
        url: 'authors.html',
        robots: INDEXABLE_ROBOTS,
        ogType: 'website'
    },
    'author.html': {
        title: `المؤلف | ${SITE_NAME}`,
        description: `عرض كتب مؤلف محدد في ${SITE_NAME}.`,
        url: 'authors.html',
        robots: TEMPLATE_ROBOTS,
        ogType: 'website'
    },
    'categories.html': {
        title: `التصنيفات | ${SITE_NAME}`,
        description: `تصفح كتب ${SITE_NAME} حسب التصنيفات المتاحة.`,
        url: 'categories.html',
        robots: INDEXABLE_ROBOTS,
        ogType: 'website'
    },
    'category.html': {
        title: `التصنيف | ${SITE_NAME}`,
        description: `عرض الكتب المصنفة ضمن تصنيف محدد في ${SITE_NAME}.`,
        url: 'categories.html',
        robots: TEMPLATE_ROBOTS,
        ogType: 'website'
    },
    'reader.html': {
        title: `القارئ | ${SITE_NAME}`,
        description: `قارئ ${SITE_NAME} لقراءة الكتب العربية مع فهرس فصول وبحث داخل النص.`,
        url: 'reader.html',
        robots: INDEXABLE_ROBOTS,
        ogType: 'article'
    }
});

export function applyDefaultPageSeo(pageName) {
    const config = DEFAULT_PAGE_SEO[String(pageName || '').toLowerCase()];
    if (!config) return;

    setSocialScaffold({
        locale: 'ar_AR',
        ogType: config.ogType || 'website',
        siteName: SITE_NAME,
        twitterCard: 'summary'
    });
    setSocialMetadata({
        title: config.title,
        description: config.description,
        url: config.url
    });
    setRobots(config.robots);
}
