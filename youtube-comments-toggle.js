// ==UserScript==
// @name         YouTube 댓글 토글 (개선 버전)
// @namespace    https://github.com/Lucille-dolce
// @version      1.2.1
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
                    button.innerHTML = commentIconSVG + ' <span>댓글 숨기기</span>';
                }
                commentsHidden = false;
            } else {
                commentsSection.style.display = 'none';
                if (button) {
                    button.innerHTML = commentIconSVG + ' <span>댓글 표시</span>';
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
                button.innerHTML = commentIconSVG + ' <span>댓글 표시</span>';
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
    
    // URL 변경 감지 함수
    function checkForUrlChange() {
        if (currentUrl !== window.location.href) {
            currentUrl = window.location.href;
            
            // 동영상 페이지인지 확인
            if (currentUrl.includes('/watch')) {
                // 초기화 상태 리셋
                initialized = false;
                // 댓글 숨기기 재시도
                attempts = 0;
                // 약간의 지연 후 초기화 시도
                setTimeout(initOnVideoPage, 500);
                
                // 버튼 표시
                const container = document.getElementById('yt-comments-toggle-container');
                if (container) {
                    container.style.display = 'flex';
                }
            } else {
                // 동영상 페이지가 아니면 버튼 숨기기
                const container = document.getElementById('yt-comments-toggle-container');
                if (container) {
                    container.style.display = 'none';
                }
            }
        }
    }
    
    // 비디오 페이지 초기화 함수
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
                button.innerHTML = commentIconSVG + ' <span>댓글 표시</span>';
            }
        }
        
        initialized = true;
    }
    
    // 키보드 단축키 이벤트 리스너
    function setupKeyboardShortcut() {
        document.addEventListener('keydown', function(e) {
            // Alt+C로 댓글 토글
            if (e.altKey && e.key === 'c') {
                if (window.location.href.includes('/watch')) {
                    toggleComments();
                }
            }
        });
    }
    
    // DOM 변화 감지를 위한 MutationObserver
    function setupMutationObserver() {
        // 페이지 변화 감지
        const bodyObserver = new MutationObserver(function(mutations) {
            // URL 변경 확인
            checkForUrlChange();
            
            // 동영상 페이지인지 확인
            if (window.location.href.includes('/watch')) {
                // 댓글 섹션이 로드되었고 숨겨진 상태여야 하는지 확인
                if (!initialized || commentsHidden) {
                    attemptHideComments();
                }
            }
        });
        
        // 전체 DOM 변화 감시
        bodyObserver.observe(document.documentElement, { 
            childList: true, 
            subtree: true, 
            attributes: false, 
            characterData: false 
        });
    }
    
    // 유튜브 SPA 이벤트 리스너 설정
    function setupYoutubeEvents() {
        // 유튜브 내비게이션 완료 이벤트
        document.addEventListener('yt-navigate-finish', function() {
            checkForUrlChange();
            
            if (window.location.href.includes('/watch')) {
                initialized = false;
                setTimeout(initOnVideoPage, 500);
            }
        });
        
        // 히스토리 상태 변경 이벤트
        window.addEventListener('popstate', function() {
            checkForUrlChange();
        });
        
        // 히스토리 API 오버라이드
        const originalPushState = history.pushState;
        history.pushState = function() {
            originalPushState.apply(this, arguments);
            checkForUrlChange();
        };
        
        const originalReplaceState = history.replaceState;
        history.replaceState = function() {
            originalReplaceState.apply(this, arguments);
            checkForUrlChange();
        };
    }
    
    // 초기화 함수
    function init() {
        // URL 감시 시작
        currentUrl = window.location.href;
        
        // 동영상 페이지에서만 초기화
        if (currentUrl.includes('/watch')) {
            initOnVideoPage();
        }
        
        // MutationObserver 설정
        setupMutationObserver();
        
        // 키보드 단축키 설정
        setupKeyboardShortcut();
        
        // 유튜브 이벤트 리스너 설정
        setupYoutubeEvents();
    }
    
    // DOM이 로드되면 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // 페이지가 완전히 로드된 후에도 초기화 (일부 요소가 지연 로딩될 수 있음)
    window.addEventListener('load', function() {
        if (window.location.href.includes('/watch')) {
            // 페이지 로드 후 한 번 더 시도
            setTimeout(initOnVideoPage, 1000);
        }
    });

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
        button.innerHTML = commentIconSVG + ' <span>댓글 표시</span>';
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
        dragHandle.innerHTML = dragIconSVG;
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
        settingsButton.innerHTML = settingsIconSVG;
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
        const title = document.createElement('div');
        title.textContent = '버튼 위치 설정';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '10px';
        title.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
        title.style.paddingBottom = '6px';
        
        panel.appendChild(title);
        
        // 위치 버튼 그리드 생성
        const posGrid = document.createElement('div');
        posGrid.style.display = 'grid';
        posGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        posGrid.style.gridTemplateRows = 'repeat(3, 1fr)';
        posGrid.style.gap = '6px';
        
        // 위치 옵션 설정
        const positions = [
            { id: 'top-left', label: '↖️', top: '20px', left: '20px', right: null, bottom: null },
            { id: 'top-center', label: '⬆️', top: '20px', left: '50%', right: null, bottom: null, transform: 'translateX(-50%)' },
            { id: 'top-right', label: '↗️', top: '20px', left: null, right: '20px', bottom: null },
            { id: 'middle-left', label: '⬅️', top: '50%', left: '20px', right: null, bottom: null, transform: 'translateY(-50%)' },
            { id: 'middle-center', label: '⚙️', top: '50%', left: '50%', right: null, bottom: null, transform: 'translate(-50%, -50%)' },
            { id: 'middle-right', label: '➡️', top: '50%', left: null, right: '20px', bottom: null, transform: 'translateY(-50%)' },
            { id: 'bottom-left', label: '↙️', top: null, left: '20px', right: null, bottom: '80px' },
            { id: 'bottom-center', label: '⬇️', top: null, left: '50%', right: null, bottom: '80px', transform: 'translateX(-50%)' },
            { id: 'bottom-right', label: '↘️', top: null, left: null, right: '20px', bottom: '80px' }
        ];
        
        // 위치 버튼 생성
        positions.forEach(pos => {
            const posButton = document.createElement('button');
            posButton.textContent = pos.label;
            posButton.style.width = '100%';
            posButton.style.padding = '8px 0';
            posButton.style.background = '#272727';
            posButton.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            posButton.style.borderRadius = '4px';
            posButton.style.cursor = 'pointer';
            posButton.style.fontSize = '16px';
            
            posButton.addEventListener('mouseover', function() {
                this.style.backgroundColor = '#3A3A3A';
            });
            posButton.addEventListener('mouseout', function() {
                this.style.backgroundColor = '#272727';
            });
            
            posButton.addEventListener('click', function() {
                // 버튼 컨테이너 위치 설정
                const containerElement = document.getElementById('yt-comments-toggle-container');
                containerElement.style.top = pos.top || 'auto';
                containerElement.style.left = pos.left || 'auto';
                containerElement.style.right = pos.right || 'auto';
                containerElement.style.bottom = pos.bottom || 'auto';
                containerElement.style.transform = pos.transform || '';
                
                // 위치 저장
                buttonPosition = {
                    top: pos.top || null,
                    left: pos.left || null,
                    right: pos.right || null,
                    bottom: pos.bottom || null,
                    transform: pos.transform || null
                };
                saveButtonPosition();
                
                // 설정 패널 닫기
                panel.style.display = 'none';
            });
            
            posGrid.appendChild(posButton);
        });
        
        panel.appendChild(posGrid);
        container.appendChild(panel);
    }
    
    // 설정 패널 토글
    function toggleSettingsPanel() {
        const panel = document.getElementById('yt-comments-settings-panel');
        if (panel) {
            if (panel.style.display === 'none' || !panel.style.display) {
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
        
        // 이동할 새 위치 계산
        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;
        
        // 화면 경계 확인
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 화면 내에 유지
        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        if (newLeft + containerWidth > windowWidth) {
            newLeft = windowWidth - containerWidth;
        }
        if (newTop + containerHeight > windowHeight) {
            newTop = windowHeight - containerHeight;
        }
        
        // 위치 적용
        container.style.left = newLeft + 'px';
        container.style.top = newTop + 'px';
        container.style.right = 'auto';
        container.style.bottom = 'auto';
        container.style.transform = 'none';
    }
    
    // 드래그 중지 함수
    function stopDrag() {
        if (!isDragging) return;
        
        isDragging = false;
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', stopDrag);
        
        // 현재 위치 저장
        const container = document.getElementById('yt-comments-toggle-container');
        if (container) {
            container.style.transition = 'all 0.2s ease';
            buttonPosition = {
                top: container.style.top,
                left: container.style.left,
                right: 'auto',
                bottom: 'auto'
            };
            saveButtonPosition();
        }
    }
})();
