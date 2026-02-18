const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export const search = [
    ['path', { d: 'm21 21-4.34-4.34' }],
    ['circle', { cx: '11', cy: '11', r: '8' }]
];

export const folderTree = [
    ['path', { d: 'M20 10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2.5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 15 3h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z' }],
    ['path', { d: 'M20 21a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-2.9a1 1 0 0 1-.88-.55l-.42-.85a1 1 0 0 0-.92-.6H13a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z' }],
    ['path', { d: 'M3 5a2 2 0 0 0 2 2h3' }],
    ['path', { d: 'M3 3v13a2 2 0 0 0 2 2h3' }]
];

export const book = [
    ['path', { d: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20' }]
];

export const users = [
    ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
    ['path', { d: 'M16 3.128a4 4 0 0 1 0 7.744' }],
    ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }],
    ['circle', { cx: '9', cy: '7', r: '4' }]
];

export const bookmark = [
    ['path', { d: 'M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z' }]
];

export const bookHeart = [
    ['path', { d: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20' }],
    ['path', { d: 'M8.62 9.8A2.25 2.25 0 1 1 12 6.836a2.25 2.25 0 1 1 3.38 2.966l-2.626 2.856a.998.998 0 0 1-1.507 0z' }]
];

export const heartPlus = [
    ['path', { d: 'm14.479 19.374-.971.939a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5a5.2 5.2 0 0 1-.219 1.49' }],
    ['path', { d: 'M15 15h6' }],
    ['path', { d: 'M18 12v6' }]
];

export const heartMinus = [
    ['path', { d: 'm14.876 18.99-1.368 1.323a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5a5.2 5.2 0 0 1-.244 1.572' }],
    ['path', { d: 'M15 15h6' }]
];

export const arrowDownWideNarrow = [
    ['path', { d: 'm3 16 4 4 4-4' }],
    ['path', { d: 'M7 20V4' }],
    ['path', { d: 'M11 4h10' }],
    ['path', { d: 'M11 8h7' }],
    ['path', { d: 'M11 12h4' }]
];

const BUILTIN_ICONS = Object.freeze({
    search,
    'folder-tree': folderTree,
    book,
    users,
    bookmark,
    'book-heart': bookHeart,
    'heart-plus': heartPlus,
    'heart-minus': heartMinus,
    'arrow-down-wide-narrow': arrowDownWideNarrow
});

function toKebabCase(name) {
    return String(name)
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase();
}

function createSvgElement(tagName, attributes = {}) {
    const node = document.createElementNS(SVG_NAMESPACE, tagName);
    Object.entries(attributes).forEach(([key, value]) => {
        node.setAttribute(key, String(value));
    });
    return node;
}

function createIconNode(iconName, iconDefinition, attrs) {
    const svg = createSvgElement('svg', {
        xmlns: SVG_NAMESPACE,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        ...attrs
    });

    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('lucide', `lucide-${iconName}`);

    iconDefinition.forEach(([tagName, attributes]) => {
        svg.appendChild(createSvgElement(tagName, attributes));
    });

    return svg;
}

function resolveIconMap(icons = {}) {
    const resolved = { ...BUILTIN_ICONS };
    Object.entries(icons).forEach(([name, iconDefinition]) => {
        const key = toKebabCase(name);
        resolved[key] = iconDefinition;
    });
    return resolved;
}

function getTargetElements(root, nameAttr) {
    const targetRoot = root && typeof root.querySelectorAll === 'function' ? root : document;
    const selector = `[${nameAttr}]`;
    const elements = [...targetRoot.querySelectorAll(selector)];

    if (targetRoot instanceof Element && targetRoot.matches(selector)) {
        elements.unshift(targetRoot);
    }

    return elements;
}

export function createIcons({
    icons = {},
    attrs = {},
    nameAttr = 'data-lucide',
    root = document
} = {}) {
    const iconMap = resolveIconMap(icons);
    const targets = getTargetElements(root, nameAttr);

    targets.forEach((element) => {
        const requestedName = String(element.getAttribute(nameAttr) || '').trim();
        if (!requestedName) return;

        const iconName = toKebabCase(requestedName);
        const iconDefinition = iconMap[iconName];
        if (!iconDefinition) return;

        const iconNode = createIconNode(iconName, iconDefinition, attrs);
        element.replaceWith(iconNode);
    });
}

export function renderLucideIcons(root = document) {
    createIcons({
        root,
        icons: {
            search,
            folderTree,
            book,
            users,
            bookmark,
            bookHeart,
            heartPlus,
            heartMinus,
            arrowDownWideNarrow
        },
        attrs: {
            width: '24',
            height: '24',
            'stroke-width': '0.5'
        }
    });
}
