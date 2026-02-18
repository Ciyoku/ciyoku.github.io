export function getPartLabel(index, toArabicIndicNumber) {
    return `الجزء ${toArabicIndicNumber(index + 1)}`;
}

export function updatePartSelector(state) {
    const partButtons = document.querySelectorAll('[data-part-index]');
    partButtons.forEach((button) => {
        const isActive = Number(button.dataset.partIndex) === state.currentPartIndex;
        button.classList.toggle('is-active', isActive);
    });
}

export function renderPartSelector({ state, onSelectPart, onAfterSelectPart }) {
    const chapterList = document.getElementById('chapterList');
    let container = document.getElementById('partSelector');

    if (!container) {
        container = document.createElement('div');
        container.id = 'partSelector';
        container.className = 'part-selector';
        chapterList.parentNode.insertBefore(container, chapterList);
    }

    if (state.bookParts.length <= 1) {
        container.hidden = true;
        container.replaceChildren();
        return;
    }

    container.hidden = false;
    container.replaceChildren();

    const title = document.createElement('div');
    title.className = 'part-selector-title';
    title.textContent = 'الأجزاء';
    container.appendChild(title);

    state.bookParts.forEach((part, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'part-selector-btn';
        button.dataset.partIndex = String(index);
        button.textContent = part.label;

        if (part.status === 'loading') {
            button.disabled = true;
            button.classList.add('is-loading');
        }

        if (part.status === 'missing') {
            button.disabled = true;
            button.classList.add('is-missing');
        }

        button.title = part.status === 'missing' ? 'هذا الجزء غير متوفر' : part.label;

        button.addEventListener('click', () => {
            onSelectPart(Number(button.dataset.partIndex));
            if (typeof onAfterSelectPart === 'function') {
                onAfterSelectPart();
            }
        });
        container.appendChild(button);
    });

    updatePartSelector(state);
}
