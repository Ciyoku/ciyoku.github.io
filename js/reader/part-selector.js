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
        return;
    }

    container.hidden = false;
    const buttonsHtml = state.bookParts
        .map((part, index) => (
            `<button type="button" class="part-selector-btn" data-part-index="${index}">${part.label}</button>`
        ))
        .join('');

    container.innerHTML = `
        <div class="part-selector-title">الأجزاء</div>
        ${buttonsHtml}
    `;

    container.querySelectorAll('[data-part-index]').forEach((button) => {
        button.addEventListener('click', () => {
            onSelectPart(Number(button.dataset.partIndex));
            if (typeof onAfterSelectPart === 'function') {
                onAfterSelectPart();
            }
        });
    });

    updatePartSelector(state);
}
