// ==UserScript==
// @name         YouTube 댓글 토글 (개선 버전)
// @namespace    https://github.com/Lucille-dolce
// @version      1.2.3
// @description  유튜브 댓글을 기본적으로 숨기고 토글 버튼으로 표시/숨기기 할 수 있음 [제작: 클로드 소넷 3.7 Thinking]
// @author       Lucille
// @match        https://www.youtube.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/Lucille-dolce/YTCommentToggle/main/youtube-comments-toggle.js
// @downloadURL  https://raw.githubusercontent.com/Lucille-dolce/YTCommentToggle/main/youtube-comments-toggle.js
// ==/UserScript==

/*
 * ===================================================================================================
 * 🔴 중요: 위 항목들은 필요에 따라 직접 수정하세요! 🔴
 * ===================================================================================================
 * @namespace   - 스크립트 네임스페이스 (예: https://github.com/yourusername/youtube-comments-toggle)
 * @description - 스크립트 설명 (예: HSP를 위한 유튜브 댓글 숨김/표시 토글 스크립트)
 * @author      - 작성자 정보 (예: 홍길동)
 * @updateURL   - 업데이트 URL (예: https://github.com/yourusername/userscripts/youtube-comments-toggle.user.js)
 * @downloadURL - 다운로드 URL (예: https://github.com/yourusername/userscripts/youtube-comments-toggle.user.js)
 * ===================================================================================================
 */

(function() {
    'use strict';
    
    // 설정 및 상태 관리 변수
    let commentsHidden = true;
    let currentUrl = window.location.href;
    let initialized = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 20;
    let buttonCreated = false;
    let isDragging = false;
    let offsetX, offsetY;
    
    // 버튼 위치 설정 - 저장된 값이 없으면 기본값 사용
    let buttonPosition = {
        top: null,
        left: null,
        right: '20px',
        bottom: '80px'
    };
    
    // 저장된 위치 불러오기 (Violentmonkey에서 지원하는 경우)
    try {
        const savedPosition = typeof GM_getValue === 'function' ? GM_getValue('buttonPosition', null) : null;
        if (savedPosition) {
            buttonPosition = JSON.parse(savedPosition);
        }
    } catch (e) {
        console.log('위치 설정을 불러올 수 없습니다:', e);
    }
    
    // 버튼 위치 저장 함수
    function saveButtonPosition() {
        if (typeof GM_setValue === 'function') {
            GM_setValue('buttonPosition', JSON.stringify(buttonPosition));
        }
    }
    
    // 안전한 HTML 요소 생성 함수 (Trusted Type 오류 방지)
    function createSvgElement(svgString) {
        // SVG 문자열에서 필요한 속성을 추출
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
        const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        
        // 원본 SVG의 속성을 복사
        const originalSvg = svgDoc.querySelector('svg');
        if (originalSvg) {
            const attrs = originalSvg.attributes;
            for (let i = 0; i < attrs.length; i++) {
                svgElement.setAttribute(attrs[i].name, attrs[i].value);
            }
            
            // 내부 요소들을 처리
            Array.from(originalSvg.childNodes).forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const clone = document.createElementNS('http://www.w3.org/2000/svg', node.tagName);
                    Array.from(node.attributes).forEach(attr => {
                        clone.setAttribute(attr.name, attr.value);
                    });
                    svgElement.appendChild(clone);
                }
            });
        }
        
        return svgElement;
    }
    
    // 댓글 아이콘 SVG (간단한 버블 형태)
    const commentIconSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
    `;
    
    // 설정 아이콘 SVG
    const settingsIconSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
    `;
    
    // 드래그 아이콘 SVG
    const dragIconSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="12" r="1"></circle>
        <circle cx="15" cy="12" r="1"></circle>
        <circle cx="9" cy="6" r="1"></circle>
        <circle cx="15" cy="6" r="1"></circle>
        <circle cx="9" cy="18" r="1"></circle>
        <circle cx="15" cy="18" r="1"></circle>
    </svg>
    `;
    
    // 댓글 섹션 찾기 (여러 선택자 시도)
    function findCommentsSection() {
        // 동영상 페이지에 있는지 확인
        if (!window.location.href.includes('/watch')) {
            return null;
        }
        
        // 유튜브의 다양한 버전에 대응하기 위한 선택자 목록
        const selectors = [
            '#comments', 
            'ytd-comments#comments',
            '#comment-section',
            '#comment-teaser',
            'ytd-item-section-renderer#sections',
            '#below ytd-comments',
            'ytd-comments',
            '#related #comments',
            '#below',
            '#secondary-inner #comments',
            '#watch-discussion',
            '.watch-discussion',
            '.comment-section-renderer'
        ];
        
        // 각 선택자를 시도
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                console.log('댓글 섹션을 찾았습니다:', selector);
                return element;
            }
        }
        
        // 디버깅 정보 추가
        console.log('댓글 섹션을 찾지 못했습니다. 댓글 선택자가 변경되었을 수 있습니다.');
        
        // 좀 더 일반적인 방법으로 시도 (HTML 구조 분석)
        const commentsText = document.evaluate(
            '//h2[contains(text(), "댓글") or contains(text(), "Comments")]',
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;
        
        if (commentsText) {
            let parent = commentsText.parentElement;
            // 상위 요소 중에서 댓글 섹션을 찾음 (최대 5번 상위로 이동)
            for (let i = 0; i < 5; i++) {
                if (parent) {
                    console.log('댓글 섹션을 텍스트로 찾았습니다:', parent);
                    return parent;
                }
                parent = parent.parentElement;
            }
        }
        
        return null;
    }
    
    // 댓글 표시/숨기기 토글 함수
    function toggleComments() {
        const commentsSection = findCommentsSection();
        const button = document.getElementById('toggle-comments-button');
        
        if (commentsSection) {
            if (commentsHidden) {
                commentsSection.style.display = 'block';
                if (button) {
                    button.innerHTML = '';
                    button.appendChild(createSvgElement(commentIconSVG));
                    button.appendChild(document.createTextNode(' 댓글 숨기기'));
                }
                commentsHidden = false;
            } else {
                commentsSection.style.display = 'none';
                if (button) {
                    button.innerHTML = '';
                    button.appendChild(createSvgElement(commentIconSVG));
                    button.appendChild(document.createTextNode(' 댓글 표시'));
                }
                commentsHidden = true;
            }
        }
    }
    
    // 댓글 숨기기 함수
    function hideComments() {
        const commentsSection = findCommentsSection();
        if (commentsSection) {
            commentsSection.style.display = 'none';
            commentsHidden = true;
            // 버튼 텍스트 업데이트
            const button = document.getElementById('toggle-comments-button');
            if (button) {
                button.innerHTML = '';
                button.appendChild(createSvgElement(commentIconSVG));
                button.appendChild(document.createTextNode(' 댓글 표시'));
            }
            return true;
        }
        return false;
    }
    
    // 재시도 메커니즘으로 댓글 숨기기
    function attemptHideComments() {
        if (attempts >= MAX_ATTEMPTS) {
            attempts = 0;
            return;
        }
        
        if (!hideComments()) {
            attempts++;
            setTimeout(attemptHideComments, 300);
        } else {
            attempts = 0;
        }
    }
    
    // URL 변경 감지 및 처리
    function checkForUrlChange() {
        const newUrl = window.location.href;
        if (currentUrl !== newUrl) {
            currentUrl = newUrl;
            // 동영상 페이지 진입 시
            if (newUrl.includes('/watch')) {
                initialized = false;
                initOnVideoPage();
            } else {
                // 동영상 페이지 이탈 시
                const container = document.getElementById('yt-comments-toggle-container');
                if (container) {
                    container.style.display = 'none';
                }
            }
        }
    }
    
    // 동영상 페이지에서 초기화
    function initOnVideoPage() {
        if (initialized) return;
        
        // 댓글 숨기기 시도
        attemptHideComments();
        
        // 버튼이 없으면 생성
        if (!buttonCreated) {
            createToggleButton();
        } else {
            // 버튼이 이미 있으면 표시 상태 업데이트
            const container = document.getElementById('yt-comments-toggle-container');
            if (container) {
                container.style.display = 'flex';
            }
            
            const button = document.getElementById('toggle-comments-button');
            if (button) {
                button.innerHTML = '';
                button.appendChild(createSvgElement(commentIconSVG));
                button.appendChild(document.createTextNode(' 댓글 표시'));
            }
        }
        
        // 키보드 단축키 설정
        setupKeyboardShortcut();
        
        initialized = true;
    }
    
    // 키보드 단축키 설정 함수
    function setupKeyboardShortcut() {
        document.addEventListener('keydown', function(e) {
            // Alt + C 키 조합으로 댓글 토글
            if (e.altKey && e.code === 'KeyC') {
                toggleComments();
            }
        });
    }
    
    // 페이지 변경 감지를 위한 MutationObserver 설정
    function setupMutationObserver() {
        const observer = new MutationObserver(function(mutations) {
            // 페이지 URL이 바뀌었는지 확인
            checkForUrlChange();
            
            // 댓글 UI를 다시 찾아 숨기기 (동적 로딩 대응)
            if (window.location.href.includes('/watch') && commentsHidden) {
                attemptHideComments();
            }
        });
        
        // 페이지 변경 감지를 위해 body 전체를 감시
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // 유튜브 이벤트 핸들러 설정
    function setupYoutubeEvents() {
        // 페이지 로드 완료 시
        window.addEventListener('load', function() {
            if (window.location.href.includes('/watch')) {
                initOnVideoPage();
            }
        });
        
        // 히스토리 API를 통한 페이지 변경 감지
        window.addEventListener('popstate', function() {
            setTimeout(checkForUrlChange, 100);
        });
        
        // 정기적인 URL 변경 체크 (Single Page Application 특성 대응)
        setInterval(checkForUrlChange, 1000);
        
        // MutationObserver 설정
        setupMutationObserver();
    }
    
    // 기본 초기화 함수
    function init() {
        // 이미 초기화되었는지 확인
        if (initialized) return;
        
        try {
            // 현재 비디오 페이지인지 확인
            if (window.location.href.includes('/watch')) {
                initOnVideoPage();
            }
            
            // 유튜브 이벤트 핸들러 설정
            setupYoutubeEvents();
            
        } catch (error) {
            console.error('초기화 중 오류가 발생했습니다:', error);
        }
    }
    
    // 스크립트 초기화 함수 - document ready 또는 DOMContentLoaded 이벤트 발생 시 호출
    function initializeScript() {
        try {
            init();
        } catch (e) {
            console.error('초기화 중 오류가 발생했습니다:', e);
        }
    }
    
    // document가 이미 로드되었는지 확인하고 적절한 타이밍에 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeScript);
    } else {
        // 이미 로드된 경우 바로 초기화
        setTimeout(initializeScript, 0);
    }
    
    // 스크립트 실행 전 페이지가 변경되는 것을 감지하기 위한 interval 설정
    setInterval(checkForUrlChange, 1000);

    // 토글 버튼 생성 함수
    function createToggleButton() {
        // 이미 버튼이 있는지 확인
        if (document.getElementById('toggle-comments-button')) {
            buttonCreated = true;
            return document.getElementById('toggle-comments-button');
        }
        
        // 버튼 컨테이너 생성 - 드래그 가능하게 함
        const container = document.createElement('div');
        container.id = 'yt-comments-toggle-container';
        container.style.position = 'fixed';
        container.style.zIndex = '9999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '8px';
        
        // 위치 설정
        if (buttonPosition.top !== null) container.style.top = buttonPosition.top;
        if (buttonPosition.right !== null) container.style.right = buttonPosition.right;
        if (buttonPosition.bottom !== null) container.style.bottom = buttonPosition.bottom;
        if (buttonPosition.left !== null) container.style.left = buttonPosition.left;
        
        // 메인 토글 버튼 생성
        const button = document.createElement('button');
        button.id = 'toggle-comments-button';
        button.name = 'toggle-comments-button';
        button.setAttribute('aria-label', '댓글 토글 버튼');
        
        // 안전한 방식으로 버튼 내용 설정
        button.appendChild(createSvgElement(commentIconSVG));
        button.appendChild(document.createTextNode(' 댓글 표시'));
        
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.gap = '6px';
        button.style.padding = '8px 12px';
        button.style.backgroundColor = '#0F0F0F';
        button.style.color = 'white';
        button.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        button.style.borderRadius = '18px';
        button.style.cursor = 'pointer';
        button.style.fontWeight = 'bold';
        button.style.fontSize = '14px';
        button.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
        button.style.transition = 'all 0.2s ease';
        button.style.minWidth = '120px';
        
        // 마우스 오버 효과
        button.addEventListener('mouseover', function() {
            this.style.backgroundColor = '#272727';
            this.style.transform = 'scale(1.03)';
        });
        button.addEventListener('mouseout', function() {
            this.style.backgroundColor = '#0F0F0F';
            this.style.transform = 'scale(1)';
        });
        
        // 클릭 이벤트
        button.addEventListener('click', toggleComments);
        
        // 드래그 핸들 생성
        const dragHandle = document.createElement('div');
        dragHandle.id = 'yt-comments-drag-handle';
        dragHandle.setAttribute('aria-label', '버튼 위치 드래그');
        
        dragHandle.appendChild(createSvgElement(dragIconSVG));
        
        dragHandle.style.position = 'absolute';
        dragHandle.style.top = '-18px';
        dragHandle.style.right = '10px';
        dragHandle.style.backgroundColor = '#0F0F0F';
        dragHandle.style.color = '#AAAAAA';
        dragHandle.style.width = '24px';
        dragHandle.style.height = '18px';
        dragHandle.style.display = 'flex';
        dragHandle.style.alignItems = 'center';
        dragHandle.style.justifyContent = 'center';
        dragHandle.style.borderRadius = '4px 4px 0 0';
        dragHandle.style.cursor = 'move';
        dragHandle.style.opacity = '0';
        dragHandle.style.transition = 'opacity 0.2s ease';
        
        // 컨테이너에 마우스를 올리면 드래그 핸들 표시
        container.addEventListener('mouseenter', function() {
            dragHandle.style.opacity = '1';
        });
        container.addEventListener('mouseleave', function() {
            if (!isDragging) {
                dragHandle.style.opacity = '0';
                // 설정 패널이 열려있지 않은 경우에만 설정 버튼 숨기기
                if (!document.getElementById('yt-comments-settings-panel') || 
                    document.getElementById('yt-comments-settings-panel').style.display === 'none') {
                    settingsButton.style.opacity = '0';
                }
            }
        });
        
        // 드래그 기능 설정
        dragHandle.addEventListener('mousedown', function(e) {
            isDragging = true;
            offsetX = e.clientX - container.getBoundingClientRect().left;
            offsetY = e.clientY - container.getBoundingClientRect().top;
            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', stopDrag);
            container.style.transition = 'none';
        });
        
        // 설정 버튼 생성
        const settingsButton = document.createElement('div');
        settingsButton.id = 'yt-comments-settings-button';
        settingsButton.setAttribute('aria-label', '설정 버튼');
        
        settingsButton.appendChild(createSvgElement(settingsIconSVG));
        
        settingsButton.style.position = 'absolute';
        settingsButton.style.top = '-18px';
        settingsButton.style.left = '10px';
        settingsButton.style.backgroundColor = '#0F0F0F';
        settingsButton.style.color = '#AAAAAA';
        settingsButton.style.width = '24px';
        settingsButton.style.height = '18px';
        settingsButton.style.display = 'flex';
        settingsButton.style.alignItems = 'center';
        settingsButton.style.justifyContent = 'center';
        settingsButton.style.borderRadius = '4px 4px 0 0';
        settingsButton.style.cursor = 'pointer';
        settingsButton.style.opacity = '0';
        settingsButton.style.transition = 'opacity 0.2s ease';
        
        // 설정 버튼 마우스 오버 효과
        settingsButton.addEventListener('mouseover', function() {
            this.style.color = '#FFFFFF';
        });
        settingsButton.addEventListener('mouseout', function() {
            this.style.color = '#AAAAAA';
        });
        
        // 컨테이너에 마우스를 올리면 설정 버튼 표시
        container.addEventListener('mouseenter', function() {
            settingsButton.style.opacity = '1';
        });
        
        // 설정 버튼 클릭 이벤트 - 설정 패널 토글
        settingsButton.addEventListener('click', toggleSettingsPanel);
        
        // 컨테이너에 버튼들 추가
        container.appendChild(button);
        container.appendChild(dragHandle);
        container.appendChild(settingsButton);
        
        // 설정 패널 생성
        createSettingsPanel(container);
        
        document.body.appendChild(container);
        buttonCreated = true;
        return button;
    }
    
    // 설정 패널 생성
    function createSettingsPanel(container) {
        const panel = document.createElement('div');
        panel.id = 'yt-comments-settings-panel';
        panel.style.display = 'none';
        panel.style.position = 'absolute';
        panel.style.top = 'calc(100% + 10px)';
        panel.style.left = '0';
        panel.style.backgroundColor = '#0F0F0F';
        panel.style.color = 'white';
        panel.style.padding = '12px';
        panel.style.borderRadius = '8px';
        panel.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        panel.style.width = '200px';
        panel.style.zIndex = '10000';
        panel.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        
        // 제목 추가
        const title = document.createElement('h3');
        title.textContent = '설정';
        title.style.margin = '0 0 10px 0';
        title.style.fontSize = '14px';
        title.style.fontWeight = 'bold';
        title.style.color = '#FFFFFF';
        panel.appendChild(title);
        
        // 설정 항목 컨테이너
        const settingsContainer = document.createElement('div');
        settingsContainer.style.display = 'flex';
        settingsContainer.style.flexDirection = 'column';
        settingsContainer.style.gap = '10px';
        
        // 버튼 위치 초기화 옵션
        const resetPositionDiv = document.createElement('div');
        resetPositionDiv.style.display = 'flex';
        resetPositionDiv.style.alignItems = 'center';
        resetPositionDiv.style.justifyContent = 'space-between';
        
        const resetLabel = document.createElement('span');
        resetLabel.textContent = '버튼 위치 초기화';
        resetLabel.style.fontSize = '12px';
        
        const resetButton = document.createElement('button');
        resetButton.textContent = '초기화';
        resetButton.style.padding = '4px 8px';
        resetButton.style.backgroundColor = '#3EA6FF';
        resetButton.style.border = 'none';
        resetButton.style.borderRadius = '4px';
        resetButton.style.cursor = 'pointer';
        resetButton.style.fontSize = '12px';
        resetButton.style.fontWeight = 'bold';
        
        resetButton.addEventListener('click', function() {
            buttonPosition = {
                top: null,
                left: null,
                right: '20px',
                bottom: '80px'
            };
            
            const container = document.getElementById('yt-comments-toggle-container');
            if (container) {
                container.style.top = '';
                container.style.left = '';
                container.style.right = buttonPosition.right;
                container.style.bottom = buttonPosition.bottom;
            }
            
            saveButtonPosition();
        });
        
        resetPositionDiv.appendChild(resetLabel);
        resetPositionDiv.appendChild(resetButton);
        
        // 단축키 정보
        const shortcutDiv = document.createElement('div');
        shortcutDiv.style.marginTop = '10px';
        
        const shortcutLabel = document.createElement('span');
        shortcutLabel.textContent = '단축키:';
        shortcutLabel.style.fontSize = '12px';
        shortcutLabel.style.display = 'block';
        shortcutLabel.style.marginBottom = '5px';
        
        const shortcutInfo = document.createElement('div');
        shortcutInfo.textContent = 'Alt + C: 댓글 토글';
        shortcutInfo.style.fontSize = '12px';
        shortcutInfo.style.backgroundColor = '#272727';
        shortcutInfo.style.padding = '6px';
        shortcutInfo.style.borderRadius = '4px';
        
        shortcutDiv.appendChild(shortcutLabel);
        shortcutDiv.appendChild(shortcutInfo);
        
        // 버전 정보
        const versionDiv = document.createElement('div');
        versionDiv.style.marginTop = '15px';
        versionDiv.style.fontSize = '11px';
        versionDiv.style.color = '#AAAAAA';
        versionDiv.style.textAlign = 'center';
        versionDiv.textContent = '유튜브 댓글 토글 v1.2.3';
        
        // 컨테이너에 설정 항목들 추가
        settingsContainer.appendChild(resetPositionDiv);
        settingsContainer.appendChild(shortcutDiv);
        settingsContainer.appendChild(versionDiv);
        
        panel.appendChild(settingsContainer);
        container.appendChild(panel);
    }
    
    // 설정 패널 표시/숨기기 토글
    function toggleSettingsPanel() {
        const panel = document.getElementById('yt-comments-settings-panel');
        if (panel) {
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        }
    }
    
    // 드래그 처리 함수
    function handleDrag(e) {
        if (!isDragging) return;
        
        const container = document.getElementById('yt-comments-toggle-container');
        if (!container) return;
        
        // 마우스 위치에 따라 컨테이너 위치 계산
        const x = e.clientX - offsetX;
        const y = e.clientY - offsetY;
        
        // 화면 경계 체크
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        
        // 화면 경계를 벗어나지 않도록 설정
        let newLeft = Math.max(0, Math.min(x, viewportWidth - containerWidth));
        let newTop = Math.max(0, Math.min(y, viewportHeight - containerHeight));
        
        // 위치 업데이트
        container.style.left = newLeft + 'px';
        container.style.top = newTop + 'px';
        container.style.right = '';
        container.style.bottom = '';
        
        // 위치 정보 업데이트
        buttonPosition = {
            top: newTop + 'px',
            left: newLeft + 'px',
            right: null,
            bottom: null
        };
    }
    
    // 드래그 종료 함수
    function stopDrag() {
        if (isDragging) {
            isDragging = false;
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
            
            // 위치 저장
            saveButtonPosition();
            
            // 트랜지션 복원
            const container = document.getElementById('yt-comments-toggle-container');
            if (container) {
                container.style.transition = 'all 0.2s ease';
            }
        }
    }
})(); 
