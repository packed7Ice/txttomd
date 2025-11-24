document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const fileInput = document.getElementById('fileInput');
    const fileNameDisplay = document.getElementById('fileName');
    const inputText = document.getElementById('inputText');
    const splitBtn = document.getElementById('splitBtn');
    const itemsContainer = document.getElementById('itemsContainer');
    const resultText = document.getElementById('resultText'); // Note: This might be null if we removed it, but we kept it in previous steps? No, we replaced it with previewArea in index.html, but we need it for copy/download? 
    // Wait, in Step 133 script.js update, I used `latestMarkdown` variable to store the markdown text for copy/download.
    // And `collectMarkdown` updates `previewArea.innerHTML`.
    // Let's check index.html again.
    // Step 131 replaced textarea#resultText with div#previewArea.
    // So `document.getElementById('resultText')` will be null.
    // We should remove `resultText` from DOM Elements and use `previewArea`.
    
    // Scroll Sync Logic
    const previewArea = document.getElementById('previewArea');
    let isSyncingLeft = false;
    let isSyncingRight = false;

    itemsContainer.addEventListener('scroll', () => {
        if (!isSyncingLeft) {
            isSyncingRight = true;
            // Calculate percentage
            const percentage = itemsContainer.scrollTop / (itemsContainer.scrollHeight - itemsContainer.clientHeight);
            if (previewArea) {
                previewArea.scrollTop = percentage * (previewArea.scrollHeight - previewArea.clientHeight);
            }
        }
        isSyncingLeft = false;
    });

    if (previewArea) {
        previewArea.addEventListener('scroll', () => {
            if (!isSyncingRight) {
                isSyncingLeft = true;
                const percentage = previewArea.scrollTop / (previewArea.scrollHeight - previewArea.clientHeight);
                itemsContainer.scrollTop = percentage * (itemsContainer.scrollHeight - itemsContainer.clientHeight);
            }
            isSyncingRight = false;
        });
    }

    // Event Listeners
    fileInput.addEventListener('change', handleFileSelect);
    splitBtn.addEventListener('click', handleSplitClick);
    copyBtn.addEventListener('click', handleCopyMarkdown);
    downloadBtn.addEventListener('click', handleDownloadMarkdown);

    // Keyboard Navigation for Editor-like feel
    itemsContainer.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'TEXTAREA') {
            const card = e.target.closest('.item-card');
            if (!card) return;

            if (e.key === 'ArrowUp' && e.target.selectionStart === 0) {
                // Move to previous card
                const prev = card.previousElementSibling;
                if (prev) {
                    e.preventDefault();
                    const ta = prev.querySelector('textarea');
                    if (ta) {
                        ta.focus();
                        // Move cursor to end? Or keep position? End is usually better when moving up/down in lines
                        // But standard editor moves to same column. That's hard. Let's just focus.
                    }
                }
            } else if (e.key === 'ArrowDown' && e.target.selectionEnd === e.target.value.length) {
                // Move to next card
                const next = card.nextElementSibling;
                if (next) {
                    e.preventDefault();
                    const ta = next.querySelector('textarea');
                    if (ta) ta.focus();
                }
            } else if (e.key === 'Enter' && !e.shiftKey) {
                // Optional: Enter could create new line (split item) or just normal newline.
                // User asked for "Editor-like functionality". 
                // In this tool, "Enter" inside textarea usually means newline in that item.
                // Let's keep default behavior for now to avoid confusion, 
                // unless user wants "Enter" to create new Item.
                // For now, let's stick to navigation.
            }
        }
    });

    // Markdown Types Definition
    const MARKDOWN_TYPES = {
        h2: {
            label: '見出し(H2)',
            template: (text) => `## ${text}`
        },
        h3: {
            label: '見出し(H3)',
            template: (text) => `### ${text}`
        },
        list: {
            label: 'リスト',
            template: (text) => `- ${text}`
        },
        task: {
            label: 'タスク',
            template: (text) => `- [ ] ${text}`
        },
        code: {
            label: 'コード',
            template: (text) => `\`\`\`\n${text}\n\`\`\``
        },
        quote: {
            label: '引用',
            template: (text) => `> ${text}`
        },
        plain: {
            label: 'テキスト',
            template: (text) => text
        }
    };

    let latestMarkdown = '';

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
        createItemsFromText(text);
        collectMarkdown(); // Initial collection
    }

    function detectType(text) {
        // This function is now only used if no specific type is forced, 
        // but based on requirements, we mainly use forced types (h2 for first, plain for others).
        // However, keeping some logic might be useful if we want 'smart' detection later.
        // For now, let's respect the user's request: "others default to text".
        return 'plain';
    }

    function createItemCard(lineText, index, forcedType = null) {
        const card = document.createElement('div');
        card.className = 'item-card is-active'; // Default active

        // Gutter (Breakpoint area)
        const gutter = document.createElement('div');
        gutter.className = 'card-gutter';
        
        // Line number (optional, maybe just button now?)
        // Let's keep line number for reference above button? Or just button.
        // User asked for button below line number.
        const lineNum = document.createElement('span');
        lineNum.textContent = index;
        gutter.appendChild(lineNum);

        const dot = document.createElement('div');
        dot.className = 'breakpoint-dot';
        gutter.appendChild(dot);

        // Toggle active on gutter click (but careful with button click)
        gutter.addEventListener('click', (e) => {
            // If clicked on button or popover, don't toggle
            if (e.target.closest('.type-badge-btn') || e.target.closest('.type-popover')) {
                e.stopPropagation();
                return;
            }
            
            card.classList.toggle('is-active');
            card.classList.toggle('is-inactive');
            collectMarkdown();
        });

        // Type Settings (Moved to Gutter)
        // Determine type: forced > detected > default
        let currentType = forcedType || detectType(lineText);

        const typeBtn = document.createElement('button');
        typeBtn.className = 'type-badge-btn gutter-type-btn'; // Add class for gutter styling
        typeBtn.textContent = MARKDOWN_TYPES[currentType].label;
        typeBtn.dataset.type = currentType;
        typeBtn.title = 'クリックしてMarkdown形式を変更';

        const popover = document.createElement('div');
        popover.className = 'type-popover';

        // Create Options
        Object.keys(MARKDOWN_TYPES).forEach(key => {
            const option = document.createElement('div');
            option.className = 'type-option';
            option.textContent = MARKDOWN_TYPES[key].label;
            
            option.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent gutter click
                currentType = key;
                
                // Update Button UI
                typeBtn.textContent = MARKDOWN_TYPES[key].label;
                typeBtn.dataset.type = key;

                // Apply Template
                textarea.value = MARKDOWN_TYPES[key].template(lineText);
                textarea.dispatchEvent(new Event('input')); // Trigger resize and collect
                
                popover.classList.remove('show');
            });

            popover.appendChild(option);
        });

        typeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent gutter click
            
            const isShowing = popover.classList.contains('show');

            // Close other popovers
            document.querySelectorAll('.type-popover.show').forEach(p => {
                p.classList.remove('show');
                p.style.display = 'none'; // Ensure hidden
                // Move back to original parent if needed, or just hide. 
                // Since we are using fixed positioning now, we don't strictly need to move it back to DOM hierarchy if we just hide it.
                // But let's keep it simple: just toggle visibility and position.
            });

            if (!isShowing) {
                // Show popover
                popover.classList.add('show');
                popover.style.display = 'block';
                popover.style.position = 'fixed'; // Use fixed to escape container clipping
                popover.style.zIndex = '10000';
                
                // Calculate position
                const btnRect = typeBtn.getBoundingClientRect();
                const popoverRect = popover.getBoundingClientRect(); // Need to show it first to get rect? Yes, display block above does that.
                
                let top = btnRect.bottom;
                let left = btnRect.left;
                
                // Adjust vertical position
                if (top + popoverRect.height > window.innerHeight) {
                    top = btnRect.top - popoverRect.height;
                }
                
                popover.style.top = top + 'px';
                popover.style.left = left + 'px';
                popover.style.width = btnRect.width + 'px'; // Match button width or min-width
            } else {
                popover.classList.remove('show');
                popover.style.display = 'none';
            }
        });

        // Close popover when clicking outside
        document.addEventListener('click', (e) => {
            if (!typeBtn.contains(e.target) && !popover.contains(e.target)) {
                popover.classList.remove('show');
                popover.style.display = 'none';
            }
        });
        
        // Close popover on scroll
        itemsContainer.addEventListener('scroll', () => {
             if (popover.classList.contains('show')) {
                popover.classList.remove('show');
                popover.style.display = 'none';
             }
        });

        // Append to Gutter (initially)
        gutter.appendChild(typeBtn);
        document.body.appendChild(popover); // Append to body to ensure fixed positioning works relative to viewport without clipping

        // Content Wrapper
        const content = document.createElement('div');
        content.className = 'card-content';

        const header = document.createElement('div');
        header.className = 'card-header';
        
        // Header Left (Title)
        const headerLeft = document.createElement('div');
        headerLeft.className = 'card-header-left';
        
        const title = document.createElement('span');
        title.className = 'card-title';
        title.textContent = lineText;

        headerLeft.appendChild(title);

        header.appendChild(headerLeft);

        const textarea = document.createElement('textarea');
        // Apply initial template
        textarea.value = MARKDOWN_TYPES[currentType].template(lineText);
        
        // Auto-resize textarea
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            collectMarkdown();
        });
        // Initial resize
        setTimeout(() => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        }, 0);

        const templateBtn = document.createElement('button');
        templateBtn.className = 'template-btn';
        templateBtn.textContent = '詳細プロンプト挿入...';
        templateBtn.addEventListener('click', () => {
            const template = `
- 要件:
  - 
- 備考:
`;
            if (textarea.value.trim()) {
                textarea.value += '\n' + template;
            } else {
                textarea.value = template;
            }
            textarea.dispatchEvent(new Event('input')); // Trigger resize and collect
        });

        content.appendChild(header);
        content.appendChild(textarea);
        content.appendChild(templateBtn);

        card.appendChild(gutter);
        card.appendChild(content);

        return card;
    }

    function createItemsFromText(text) {
        itemsContainer.innerHTML = ''; // Clear existing items
        const lines = text.split(/\r\n|\n|\r/);
        let count = 0;
        let isFirstLine = true;

        lines.forEach((line) => {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                count++;
                // 1st line -> h2, others -> plain
                const type = isFirstLine ? 'h2' : 'plain';
                const itemCard = createItemCard(trimmedLine, count, type);
                itemsContainer.appendChild(itemCard);
                isFirstLine = false;
            }
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

        latestMarkdown = markdownParts.join('\n\n---\n\n');
        
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
