document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const fileInput = document.getElementById('fileInput');
    const fileNameDisplay = document.getElementById('fileName');
    const inputText = document.getElementById('inputText');
    const splitBtn = document.getElementById('splitBtn');
    const itemsContainer = document.getElementById('itemsContainer');
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const showInputBtn = document.getElementById('showInputBtn');
    
    const inputView = document.getElementById('inputView');
    const editorView = document.getElementById('editorView');

    // Configure Marked
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true
        });
    }

    // Scroll Sync Logic
    const previewArea = document.getElementById('previewArea');
    let activeScroll = null; // 'left' or 'right'

    if (itemsContainer && previewArea) {
        itemsContainer.addEventListener('mouseenter', () => { activeScroll = 'left'; });
        previewArea.addEventListener('mouseenter', () => { activeScroll = 'right'; });
        // Reset when leaving the split view area? Optional, but 'mouseenter' is usually enough.
        
        itemsContainer.addEventListener('scroll', () => {
            if (activeScroll === 'left') {
                const percentage = itemsContainer.scrollTop / (itemsContainer.scrollHeight - itemsContainer.clientHeight);
                if (isFinite(percentage)) {
                     previewArea.scrollTop = percentage * (previewArea.scrollHeight - previewArea.clientHeight);
                }
            }
        });

        previewArea.addEventListener('scroll', () => {
            if (activeScroll === 'right') {
                const percentage = previewArea.scrollTop / (previewArea.scrollHeight - previewArea.clientHeight);
                if (isFinite(percentage)) {
                    itemsContainer.scrollTop = percentage * (itemsContainer.scrollHeight - itemsContainer.clientHeight);
                }
            }
        });
    }

    // Event Listeners
    if (fileInput) fileInput.addEventListener('change', handleFileSelect);
    if (splitBtn) splitBtn.addEventListener('click', handleSplitClick);
    if (copyBtn) copyBtn.addEventListener('click', handleCopyMarkdown);
    if (downloadBtn) downloadBtn.addEventListener('click', handleDownloadMarkdown);
    
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);

    if (showInputBtn) {
        showInputBtn.addEventListener('click', () => {
            if (inputView.classList.contains('active')) {
                inputView.classList.remove('active');
                editorView.classList.add('active');
                showInputBtn.classList.remove('active');
            } else {
                inputView.classList.add('active');
                editorView.classList.remove('active');
                showInputBtn.classList.add('active');
            }
        });
    }

    // Keyboard Navigation for Editor-like feel
    if (itemsContainer) {
        itemsContainer.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'TEXTAREA') {
                const card = e.target.closest('.item-card');
                if (!card) return;
            }
        });
    }

    // Markdown Types Definition
    const MARKDOWN_TYPES = {
        h2: {
            label: '見出し(H2)',
            icon: `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><text x="8" y="12" font-size="11" text-anchor="middle" font-weight="bold" font-family="sans-serif">H2</text></svg>`,
            template: (text) => `## ${text}`
        },
        h3: {
            label: '見出し(H3)',
            icon: `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><text x="8" y="12" font-size="11" text-anchor="middle" font-weight="bold" font-family="sans-serif">H3</text></svg>`,
            template: (text) => `### ${text}`
        },
        list: {
            label: 'リスト',
            icon: `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M3 4h10v2H3V4zm0 4h10v2H3V8zm0 4h10v2H3v-2z"/></svg>`,
            template: (text) => `- ${text}`
        },
        task: {
            label: 'タスク',
            icon: `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M2 3h12v10H2V3zm2 2v6h8V5H4z"/></svg>`,
            template: (text) => `- [ ] ${text}`
        },
        code: {
            label: 'コード',
            icon: `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M5.5 4L2.5 8l3 4h1.5L4 8l3-4H5.5zm5 0l3 4-3 4h-1.5l3-4-3-4h1.5z"/></svg>`,
            template: (text) => `\`\`\`\n${text}\n\`\`\``
        },
        quote: {
            label: '引用',
            icon: `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M4 4h8v2H4V4zm0 4h8v2H4V8zm0 4h5v2H4v-2z"/></svg>`,
            template: (text) => `> ${text}`
        },
        plain: {
            label: 'テキスト',
            icon: `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h8v2H2v-2z"/></svg>`,
            template: (text) => text
        }
    };

    let latestMarkdown = '';

    // Undo/Redo History
    let historyStack = [];
    let redoStack = [];
    const MAX_HISTORY = 50;

    function saveState() {
        const state = [];
        const cards = itemsContainer.querySelectorAll('.item-card');
        cards.forEach(card => {
            const textarea = card.querySelector('textarea');
            const typeBtn = card.querySelector('.gutter-type-btn');
            state.push({
                text: textarea.value,
                type: typeBtn.dataset.type,
                isActive: card.classList.contains('is-active')
            });
        });
        
        historyStack.push(state);
        if (historyStack.length > MAX_HISTORY) historyStack.shift();
        redoStack = []; // Clear redo stack on new action
    }

    function restoreState(state) {
        itemsContainer.innerHTML = '';
        state.forEach((item, index) => {
            const card = createItemCard(item.text, index + 1, item.type);
            
            // Fix: Overwrite textarea value directly to prevent double-templating
            // because createItemCard applies template() to the input text,
            // but item.text already contains the markdown syntax.
            const textarea = card.querySelector('textarea');
            if (textarea) {
                textarea.value = item.text;
            }

            if (!item.isActive) {
                card.classList.remove('is-active');
                card.classList.add('is-inactive');
                card.querySelector('.visibility-btn').innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" style="opacity: 0.5;"><path d="M8 2C3.5 2 0 6 0 8s3.5 6 8 6 8-4 8-6-3.5-6-8-6zm0 10c-2.2 0-4-1.8-4-4 0-.6.1-1.1.3-1.6l1.3 1.3C5.2 8.3 5 8.6 5 9c0 1.7 1.3 3 3 3 .4 0 .7-.1 1-.4l1.3 1.3c-.5.1-1 .1-1.3.1zM8 5c.4 0 .7.1 1 .4l-4-4L4.3 2.1l9.6 9.6 1.4-1.4-2.7-2.7C13.6 6.9 14.8 6 16 8c0-2-3.5-6-8-6z"/></svg>`;
                card.querySelector('.visibility-btn').classList.add('is-disabled');
            }
            itemsContainer.appendChild(card);
        });
        collectMarkdown();
    }

    function undo() {
        if (historyStack.length === 0) return;
        
        // Save current state to redo stack before undoing
        const currentState = [];
        const cards = itemsContainer.querySelectorAll('.item-card');
        cards.forEach(card => {
            const textarea = card.querySelector('textarea');
            const typeBtn = card.querySelector('.gutter-type-btn');
            currentState.push({
                text: textarea.value,
                type: typeBtn.dataset.type,
                isActive: card.classList.contains('is-active')
            });
        });
        redoStack.push(currentState);

        const prevState = historyStack.pop();
        restoreState(prevState);
    }

    function redo() {
        if (redoStack.length === 0) return;

        // Save current state to history stack before redoing
        const currentState = [];
        const cards = itemsContainer.querySelectorAll('.item-card');
        cards.forEach(card => {
            const textarea = card.querySelector('textarea');
            const typeBtn = card.querySelector('.gutter-type-btn');
            currentState.push({
                text: textarea.value,
                type: typeBtn.dataset.type,
                isActive: card.classList.contains('is-active')
            });
        });
        historyStack.push(currentState);

        const nextState = redoStack.pop();
        restoreState(nextState);
    }


    // Undo/Redo Key Listener
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            if (e.shiftKey) {
                // Redo
                e.preventDefault();
                redo();
            } else {
                // Undo
                // If focus is in textarea and it's NOT empty, let browser handle text undo.
                // If it IS empty, or focus is not in textarea, trigger row undo.
                if (e.target.tagName === 'TEXTAREA' && e.target.value.length > 0) {
                    return; 
                }
                e.preventDefault();
                undo();
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            // Redo (Windows standard)
            e.preventDefault();
            redo();
        }
    });

    // Functions
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        fileNameDisplay.textContent = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            inputText.value = e.target.result;
        };
        reader.readAsText(file, 'UTF-8');
    }

    function handleSplitClick() {
        const text = inputText.value;
        if (!text.trim()) {
            alert('テキストを入力するか、ファイルを読み込んでください。');
            return;
        }
        // Clear history on new split
        historyStack = [];
        redoStack = [];
        createItemsFromText(text);
        collectMarkdown(); 
        
        inputView.classList.remove('active');
        editorView.classList.add('active');
        showInputBtn.classList.remove('active');
    }

    function detectType(text) {
        // Simple detection for now, can be expanded
        if (text.startsWith('## ')) return 'h2';
        if (text.startsWith('### ')) return 'h3';
        if (text.startsWith('- [ ] ') || text.startsWith('- [x] ')) return 'task';
        if (text.startsWith('- ')) return 'list';
        if (text.startsWith('> ')) return 'quote';
        if (text.startsWith('```')) return 'code';
        return 'plain';
    }

    function getCaretCoordinates(element, position) {
        const div = document.createElement('div');
        const style = window.getComputedStyle(element);
        
        div.style.position = 'absolute';
        div.style.visibility = 'hidden';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordWrap = 'break-word';
        div.style.width = element.clientWidth + 'px';
        div.style.height = 'auto';
        div.style.overflow = 'hidden';
        
        const properties = [
            'boxSizing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
            'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
            'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'
        ];
        
        properties.forEach(prop => {
            div.style[prop] = style[prop];
        });

        div.textContent = element.value.substring(0, position);
        
        const span = document.createElement('span');
        span.textContent = '|';
        div.appendChild(span);
        
        document.body.appendChild(div);
        
        const relativeTop = span.offsetTop;
        const relativeLeft = span.offsetLeft;
        const lineHeight = parseInt(style.lineHeight) || 20;
        
        document.body.removeChild(div);
        
        const rect = element.getBoundingClientRect();
        
        return {
            top: rect.top + relativeTop - element.scrollTop, 
            left: rect.left + relativeLeft - element.scrollLeft,
            height: lineHeight
        };
    }

    function createItemCard(lineText, index, forcedType = null) {
        const card = document.createElement('div');
        card.className = 'item-card is-active'; 

        const gutter = document.createElement('div');
        gutter.className = 'card-gutter';
        
        const lineNum = document.createElement('span');
        lineNum.textContent = index;
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'visibility-btn';
        toggleBtn.title = 'この項目を有効/無効にする';
        
        const eyeOpenIcon = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 2c-4.5 0-8 4-8 6s3.5 6 8 6 8-4 8-6-3.5-6-8-6zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/><path d="M8 5c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3z"/></svg>`;
        const eyeClosedIcon = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" style="opacity: 0.5;"><path d="M8 2C3.5 2 0 6 0 8s3.5 6 8 6 8-4 8-6-3.5-6-8-6zm0 10c-2.2 0-4-1.8-4-4 0-.6.1-1.1.3-1.6l1.3 1.3C5.2 8.3 5 8.6 5 9c0 1.7 1.3 3 3 3 .4 0 .7-.1 1-.4l1.3 1.3c-.5.1-1 .1-1.3.1zM8 5c.4 0 .7.1 1 .4l-4-4L4.3 2.1l9.6 9.6 1.4-1.4-2.7-2.7C13.6 6.9 14.8 6 16 8c0-2-3.5-6-8-6z"/></svg>`;

        toggleBtn.innerHTML = eyeOpenIcon;

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            saveState();
            const isActive = card.classList.toggle('is-active');
            card.classList.toggle('is-inactive');
            
            toggleBtn.innerHTML = isActive ? eyeOpenIcon : eyeClosedIcon;
            toggleBtn.classList.toggle('is-disabled', !isActive);
            
            collectMarkdown();
        });

        let currentType = forcedType || detectType(lineText);

        const typeBtn = document.createElement('button');
        typeBtn.className = 'type-badge-btn gutter-type-btn';
        typeBtn.innerHTML = MARKDOWN_TYPES[currentType].icon;
        typeBtn.dataset.type = currentType;
        typeBtn.title = 'クリックしてMarkdown形式を変更';

        const popover = document.createElement('div');
        popover.className = 'type-popover';

        const content = document.createElement('div');
        content.className = 'card-content';

        const textarea = document.createElement('textarea');
        textarea.value = MARKDOWN_TYPES[currentType].template(lineText);
        
        Object.keys(MARKDOWN_TYPES).forEach(key => {
            const option = document.createElement('div');
            option.className = 'type-option';
            option.innerHTML = `<span class="type-icon">${MARKDOWN_TYPES[key].icon}</span> <span class="type-label">${MARKDOWN_TYPES[key].label}</span>`;
            
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                saveState();
                
                let currentContent = textarea.value;
                // Attempt to strip existing markdown formatting for clean type change
                currentContent = currentContent.replace(/^#+\s+/, '') // H2, H3
                                               .replace(/^-\s+\[[ x]\]\s+/, '') // Task list
                                               .replace(/^-\s+/, '') // List
                                               .replace(/^>\s+/, '') // Quote
                                               .replace(/^```\n?/, '').replace(/\n?```$/, ''); // Code block
                
                currentType = key;
                
                typeBtn.innerHTML = MARKDOWN_TYPES[key].icon;
                typeBtn.dataset.type = key;

                textarea.value = MARKDOWN_TYPES[key].template(currentContent);
                textarea.dispatchEvent(new Event('input')); // Trigger input event to update height and markdown
                
                popover.classList.remove('show');
                popover.style.display = 'none';
            });

            popover.appendChild(option);
        });

        typeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShowing = popover.classList.contains('show');
            document.querySelectorAll('.type-popover.show').forEach(p => {
                p.classList.remove('show');
                p.style.display = 'none';
            });

            if (!isShowing) {
                popover.classList.add('show');
                popover.style.display = 'block';
                popover.style.position = 'fixed';
                popover.style.zIndex = '10000';
                
                const btnRect = typeBtn.getBoundingClientRect();
                const popoverRect = popover.getBoundingClientRect();
                
                let top = btnRect.bottom;
                let left = btnRect.left;
                
                // Adjust if popover goes off screen
                if (top + popoverRect.height > window.innerHeight) {
                    top = btnRect.top - popoverRect.height;
                }
                
                popover.style.top = top + 'px';
                popover.style.left = left + 'px';
                popover.style.width = '150px'; // Fixed width for consistency
            } else {
                popover.classList.remove('show');
                popover.style.display = 'none';
            }
        });

        document.addEventListener('click', (e) => {
            // Close type popover if click outside
            if (!typeBtn.contains(e.target) && !popover.contains(e.target)) {
                popover.classList.remove('show');
                popover.style.display = 'none';
            }
            // Palette popover is managed by showPalette function when focusing different textareas
            // No need to auto-close it on outside clicks
        });

        
        // Auto-resize textarea logic
        const adjustHeight = (el) => {
            el.style.height = 'auto';
            let newHeight = el.scrollHeight;
            
            if (el.value.endsWith('\n')) {
                const style = window.getComputedStyle(el);
                const lineHeight = parseFloat(style.lineHeight);
                newHeight += !isNaN(lineHeight) ? lineHeight : 20;
            }
            
            el.style.height = Math.max(newHeight, 20) + 'px';
        };

        textarea.addEventListener('input', function() {
            adjustHeight(this);
            collectMarkdown();
        });
        
        textarea.addEventListener('focus', function() {
            adjustHeight(this);
        });

        textarea.addEventListener('blur', function() {
            adjustHeight(this);
        });
        
        textarea.addEventListener('click', function() {
            adjustHeight(this);
        });

        // Initial adjustment
        setTimeout(() => {
            adjustHeight(textarea);
        }, 0);

        // Adjust height on window resize
        window.addEventListener('resize', () => {
            adjustHeight(textarea);
        });

        const palettePopover = document.createElement('div');
        palettePopover.className = 'type-popover decoration-palette';
        
        const decorations = [
            { label: '太字', icon: '<b>B</b>', insert: (text) => `**${text}**` },
            { label: '斜体', icon: '<i>I</i>', insert: (text) => `*${text}*` },
            { label: '打ち消し', icon: '<s>S</s>', insert: (text) => `~~${text}~~` },
            { label: 'コード', icon: '`C`', insert: (text) => `\`${text}\`` },
            { label: 'リンク', icon: '🔗', insert: (text) => `[${text}](url)` },
            { label: '区切り線', icon: '―', insert: (text) => `${text}\n---\n` },
            { label: '詳細', icon: '📝', insert: (text) => `${text}\n- 要件:\n  - \n- 備考:\n` }
        ];

        decorations.forEach(dec => {
            const btn = document.createElement('button');
            btn.className = 'decoration-btn';
            btn.innerHTML = dec.icon;
            btn.title = dec.label;
            
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent document click from hiding palette
                
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const selectedText = textarea.value.substring(start, end);
                
                const replacement = dec.insert(selectedText);
                
                textarea.focus();
                document.execCommand('insertText', false, replacement);
                
                // Update position as cursor moves
                updatePalettePosition();
            });

            // Prevent click event from bubbling to document
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            
            palettePopover.appendChild(btn);
        });

        const updatePalettePosition = () => {
            const caret = getCaretCoordinates(textarea, textarea.selectionStart);
            palettePopover.style.top = (caret.top + caret.height + 2) + 'px';
            palettePopover.style.left = caret.left + 'px';
        };

        const showPalette = () => {
            // Calculate position BEFORE showing to prevent flickering
            updatePalettePosition();

            document.querySelectorAll('.decoration-palette.show').forEach(p => {
                if (p !== palettePopover) {
                    p.classList.remove('show');
                    p.style.display = 'none';
                }
            });

            palettePopover.classList.add('show');
            palettePopover.style.display = 'flex';
            palettePopover.style.position = 'fixed';
            palettePopover.style.zIndex = '10000';
            palettePopover.style.minWidth = 'auto';
            palettePopover.style.width = 'auto';
            palettePopover.style.padding = '4px';
            palettePopover.style.gap = '4px';
        };

        textarea.addEventListener('focus', showPalette);
        textarea.addEventListener('click', showPalette);
        textarea.addEventListener('keyup', updatePalettePosition);
        textarea.addEventListener('input', updatePalettePosition);

        document.body.appendChild(palettePopover);

        content.appendChild(textarea);

        gutter.appendChild(lineNum);
        gutter.appendChild(toggleBtn);
        gutter.appendChild(typeBtn);

        const addBtn = document.createElement('button');
        addBtn.className = 'add-row-btn';
        addBtn.title = 'この下に行を追加';
        addBtn.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>`;
        
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            saveState();
            const newCard = createItemCard('', index + 1, 'plain');
            card.after(newCard);
            updateLineNumbers();
            const newTextarea = newCard.querySelector('textarea');
            if (newTextarea) newTextarea.focus();
            collectMarkdown();
        });

        gutter.appendChild(addBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-row-btn';
        deleteBtn.title = 'この行を削除';
        deleteBtn.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>`;

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (itemsContainer.children.length <= 1) {
                alert('最後の1行は削除できません。');
                return;
            }
            saveState();
            
            // Clean up palette popover
            if (palettePopover && palettePopover.parentNode) {
                palettePopover.parentNode.removeChild(palettePopover);
            }
            
            card.remove();
            updateLineNumbers();
            collectMarkdown();
        });

        gutter.appendChild(deleteBtn);
        
        document.body.appendChild(popover);

        card.appendChild(gutter);
        card.appendChild(content);

        return card;
    }



    function updateLineNumbers() {
        const cards = itemsContainer.querySelectorAll('.item-card');
        cards.forEach((card, idx) => {
            const lineNum = card.querySelector('.card-gutter span');
            if (lineNum) {
                lineNum.textContent = idx + 1;
            }
        });
    }

    function createItemsFromText(text) {
        itemsContainer.innerHTML = ''; // Clear existing items
        const lines = text.split(/\r\n|\n|\r/);
        let count = 0;
        let isFirstLine = true;

        lines.forEach((line) => {
            count++;
            const type = isFirstLine ? 'h2' : detectType(line); // Use detectType for subsequent lines
            const itemCard = createItemCard(line, count, type);
            itemsContainer.appendChild(itemCard);
            isFirstLine = false;
        });

        if (count === 0) {
            alert('有効な行が見つかりませんでした。');
        }
    }

    function collectMarkdown() {
        const cards = document.querySelectorAll('.item-card.is-active');
        const markdownParts = [];

        cards.forEach(card => {
            const textarea = card.querySelector('textarea');
            if (textarea && textarea.value.trim()) {
                markdownParts.push(textarea.value);
            }
        });

        latestMarkdown = markdownParts.join('\n\n');
        
        // Render HTML
        if (previewArea && typeof marked !== 'undefined') {
            previewArea.innerHTML = marked.parse(latestMarkdown);
        } else if (previewArea) {
            previewArea.textContent = latestMarkdown; // Fallback
        }
    }

    function handleCopyMarkdown() {
        if (!latestMarkdown) {
            alert('Markdownがありません。');
            return;
        }
        navigator.clipboard.writeText(latestMarkdown).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'コピーしました！';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        });
    }

    function handleDownloadMarkdown() {
        if (!latestMarkdown) {
            alert('Markdownがありません。');
            return;
        }
        const blob = new Blob([latestMarkdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'generated_prompts.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }


});
