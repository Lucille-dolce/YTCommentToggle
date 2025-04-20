// ==UserScript==
// @name         유튜브 댓글 토글 (강화 버전)
// @namespace    https://github.com/Lucille-dolce
// @version      1.3.0
// @description  유튜브 댓글을 기본적으로 숨기고 토글 버튼으로 표시/숨기기 할 수 있음 (강력 새로고침 대응 버전)
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
 * @description - 스크립트 설명 (예: 유튜브 댓글 숨김/표시 토글 스크립트)
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
    const MAX_ATTEMPTS = 30; // 최대 시도 횟수 증가
    let buttonCreated = false;
    let isDragging = false;
    let offsetX, offsetY;
    let initializationTimer = null;
    let observerActive = false;
    
    // 디버깅 모드 설정 (개발 중에만 true로 설정)
    const DEBUG_MODE = true;
    
    // 로그 출력 함수 (디버깅 모드일 때만 출력)
    function debugLog(...args) {
        if (DEBUG_MODE) {
            console.log("[유튜브 댓글 토글]", ...args);
        }
    }

    // 버튼 위치 설정 - 저장된 값이 없으면 기본값 사용
    let buttonPosition = {
        top: null,
        left: null,
        right: '20px',
        bottom: '80px'
    };

    // 저장된 위치 불러오기 (Violentmonkey/Tampermonkey에서 지원하는 경우)
    try {
        const savedPosition = typeof GM_getValue === 'function' ? GM_getValue('buttonPosition', null) : null;
        if (savedPosition) {
            buttonPosition = JSON.parse(savedPosition);
        }
    } catch (e) {
        debugLog('위치 설정을 불러올 수 없습니다:', e);
    }

    // 버튼 위치 저장 함수
    function saveButtonPosition() {
        if (typeof GM_setValue === 'function') {
            GM_setValue('buttonPosition', JSON.stringify(buttonPosition));
        }
    }

    // SVG 네임스페이스
    const svgNS = "http://www.w3.org/2000/svg";

    // 안전한 SVG 요소 생성 함수 (Trusted Types 우회)
    function createSvgElement(tagName, attributes = {}, children = []) {
        const element = document.createElementNS(svgNS, tagName);
        for (const [key, value] of Object.entries(attributes)) {
            element.setAttribute(key, value);
        }
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else {
                element.appendChild(child);
            }
        });
        return element;
    }

    // 댓글 아이콘 SVG 생성
    function createCommentIcon() {
        const path = createSvgElement('path', { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" });
        return createSvgElement('svg', {
            width: "16", height: "16", viewBox: "0 0 24 24", fill: "none",
            stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round",
            "stroke-linejoin": "round"
        }, [path]);
    }

    // 설정 아이콘 SVG 생성
    function createSettingsIcon() {
        const circle = createSvgElement('circle', { cx: "12", cy: "12", r: "3" });
        const path = createSvgElement('path', { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" });
        return createSvgElement('svg', {
            width: "14", height: "14", viewBox: "0 0 24 24", fill: "none",
            stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round",
            "stroke-linejoin": "round"
        }, [circle, path]);
    }

    // 드래그 아이콘 SVG 생성
    function createDragIcon() {
        const circles = [
            createSvgElement('circle', { cx: "9", cy: "12", r: "1" }),
            createSvgElement('circle', { cx: "15", cy: "12", r: "1" }),
            createSvgElement('circle', { cx: "9", cy: "6", r: "1" }),
            createSvgElement('circle', { cx: "15", cy: "6", r: "1" }),
            createSvgElement('circle', { cx: "9", cy: "18", r: "1" }),
            createSvgElement('circle', { cx: "15", cy: "18", r: "1" })
        ];
        return createSvgElement('svg', {
            width: "14", height: "14", viewBox: "0 0 24 24", fill: "none",
            stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round",
            "stroke-linejoin": "round"
        }, circles);
    }

    // 댓글 섹션 찾기 (강화된 버전)
    function findCommentsSection() {
        // 동영상 페이지에 있는지 확인
        if (!window.location.href.includes('/watch')) {
            return null;
        }

        debugLog("댓글 섹션 탐색 시작");

        // 유튜브의 다양한 버전에 대응하기 위한 선택자 목록 (확장 버전)
        const selectors = [
            'div#below > ytd-comments#comments',                                    // 표준 레이아웃
            'ytd-comments#comments',                                                // 기본 댓글 섹션 ID
            '#comments',                                                           // 이전 레이아웃 ID
            '#comments-section',                                                   // 다른 구조에서 사용될 수 있음
            'ytd-item-section-renderer[section-identifier="comment-item-section"]', // 특정 렌더러
            '#below ytd-comments#comments',                                        // 비디오 아래 영역
            'ytd-watch-flexy #comments',                                           // 새로운 Flexbox 레이아웃
            '#primary-inner #comments',                                            // Primary 영역 내부
            '#secondary-inner #comments',                                          // Secondary 영역 내부
            'div[id="below"] > ytd-comments[id="comments"]',                        // 속성 선택자 방식
            'ytd-watch-flexy div#below ytd-comments',                              // 가장 최신 레이아웃 
            '[page-subtype="watch"] #comments',                                     // 페이지 타입 기반
            'ytd-watch[role="main"] #comments',                                     // 메인 영역 기반
            '#primary #below #comments',                                           // 계층 구조 기반
            '#secondary #comments',                                                // 사이드바 댓글
            'ytd-engagement-panel-section-list-renderer #comments'                  // 확장 패널 내 댓글
        ];

        // 각 선택자를 시도
        for (const selector of selectors) {
            debugLog(`댓글 섹션 찾기 시도: ${selector}`);
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) { // 요소가 존재하고 화면에 실제로 표시되는지 확인
                debugLog('댓글 섹션을 찾았습니다:', selector);
                return element;
            }
        }

        // XPath를 사용한 대체 검색 방법
        debugLog('CSS 선택자를 통한 탐색 실패, XPath로 시도합니다');
        
        // 다양한 언어에 대응하기 위해 여러 텍스트 패턴 시도
        const commentTexts = ['댓글', 'Comments', '댓글 ', 'comments'];
        
        for (const textPattern of commentTexts) {
            try {
                // 댓글 텍스트를 포함하는 요소 검색
                const xpathResult = document.evaluate(
                    `//h2[contains(text(), "${textPattern}")]`,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                ).singleNodeValue;

                if (xpathResult) {
                    // 발견된 텍스트에서 가장 가까운 댓글 컨테이너 찾기
                    let parent = xpathResult.closest('ytd-item-section-renderer') || 
                                xpathResult.closest('#comments') || 
                                xpathResult.closest('ytd-comments');
                    
                    if (parent) {
                        debugLog('XPath를 통해 댓글 섹션을 찾았습니다:', parent);
                        return parent;
                    }
                    
                    // 부모 요소에서 상위로 올라가며 컨테이너 탐색
                    parent = xpathResult.parentElement;
                    for (let i = 0; i < 5; i++) { // 최대 5단계까지 상위로 탐색
                        if (!parent) break;
                        
                        // 가능한 댓글 컨테이너 속성 확인
                        if (parent.id === 'comments' || 
                            parent.tagName.toLowerCase().includes('comment') ||
                            parent.getAttribute('section-identifier') === 'comment-item-section') {
                            debugLog('XPath 부모 탐색을 통해 댓글 섹션을 찾았습니다:', parent);
                            return parent;
                        }
                        parent = parent.parentElement;
                    }
                }
            } catch (err) {
                debugLog('XPath 검색 중 오류 발생:', err);
            }
        }

        // DOM 트리 순회를 통한 마지막 시도
        debugLog('DOM 트리 순회를 통한 댓글 섹션 탐색 시도');
        const possibleContainers = document.querySelectorAll('div[id], ytd-comments, ytd-item-section-renderer');
        
        for (const container of possibleContainers) {
            // ID, 클래스이름, 속성 등에 'comment'가 포함되어 있는지 확인
            if ((container.id && container.id.toLowerCase().includes('comment')) ||
                (container.className && container.className.toLowerCase().includes('comment')) ||
                container.hasAttribute('section-identifier') && 
                container.getAttribute('section-identifier').includes('comment')) {
                
                // 화면에 보이는지 확인
                if (container.offsetParent !== null) {
                    debugLog('DOM 트리 순회를 통해 댓글 섹션을 찾았습니다:', container);
                    return container;
                }
            }
        }

        debugLog('모든 방법을 시도했으나 댓글 섹션을 찾지 못했습니다');
        return null;
    }

    // 댓글 표시/숨기기 토글 함수 (개선 버전)
    function toggleComments() {
        debugLog("댓글 토글 함수 실행");
        const commentsSection = findCommentsSection();
        const button = document.getElementById('toggle-comments-button');

        if (commentsSection) {
            if (commentsHidden) {
                // 댓글 표시
                commentsSection.style.display = 'block';
                if (button) {
                    button.innerHTML = '';
                    button.appendChild(createCommentIcon());
                    button.appendChild(document.createTextNode(' 댓글 숨기기'));
                }
                commentsHidden = false;
                debugLog("댓글이 표시되었습니다");
            } else {
                // 댓글 숨기기
                commentsSection.style.display = 'none';
                if (button) {
                    button.innerHTML = '';
                    button.appendChild(createCommentIcon());
                    button.appendChild(document.createTextNode(' 댓글 표시'));
                }
                commentsHidden = true;
                debugLog("댓글이 숨겨졌습니다");
            }
        } else {
            debugLog("토글 실패: 댓글 섹션을 찾을 수 없습니다");
            // 댓글 섹션을 찾지 못한 경우 재시도
            attempts = 0;
            attemptHideComments();
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
                button.appendChild(createCommentIcon());
                button.appendChild(document.createTextNode(' 댓글 표시'));
            }
            debugLog("댓글이 숨겨졌습니다");
            return true;
        }
        debugLog("댓글 숨기기 실패: 댓글 섹션을 찾을 수 없습니다");
        return false;
    }

    // 재시도 메커니즘으로 댓글 숨기기 (개선 버전)
    function attemptHideComments() {
        if (attempts >= MAX_ATTEMPTS) {
            debugLog(`최대 시도 횟수(${MAX_ATTEMPTS})에 도달했습니다. 댓글 섹션 탐색 중단.`);
            attempts = 0;
            return;
        }

        if (!hideComments()) {
            attempts++;
            debugLog(`댓글 숨기기 시도 ${attempts}/${MAX_ATTEMPTS}`);
            
            // 지수 백오프 적용 (재시도 간격을 점점 늘림)
            const delay = Math.min(300 * Math.pow(1.2, attempts - 1), 3000);
            setTimeout(attemptHideComments, delay);
        } else {
            attempts = 0;
        }
    }

    // URL 변경 감지 및 처리 (개선 버전)
    function checkForUrlChange() {
        const newUrl = window.location.href;
        if (currentUrl !== newUrl) {
            debugLog("URL 변경 감지:", currentUrl, "=>", newUrl);
            currentUrl = newUrl;
            
            // 기존 초기화 타이머 취소
            if (initializationTimer) {
                clearTimeout(initializationTimer);
                initializationTimer = null;
            }
            
            // 동영상 페이지 진입 시
            if (newUrl.includes('/watch')) {
                debugLog("동영상 페이지 진입, 초기화 시도...");
                initialized = false;
                buttonCreated = false; // 페이지 이동 시 버튼 재생성 필요
                
                // 지연 후 초기화 (유튜브가 DOM을 완전히 업데이트할 시간 제공)
                initializationTimer = setTimeout(() => {
                    initOnVideoPage();
                }, 500);
            } else {
                // 동영상 페이지 이탈 시
                debugLog("동영상 페이지 이탈, 버튼 숨김");
                const container = document.getElementById('yt-comments-toggle-container');
                if (container) {
                    container.style.display = 'none';
                }
            }
        }
    }

    // 동영상 페이지에서 초기화 (개선 버전)
    function initOnVideoPage() {
        if (initialized) return;
        debugLog("initOnVideoPage 실행");

        // 댓글 섹션이 나타날 때까지 기다림
        let checkAttempts = 0;
        const MAX_CHECK_ATTEMPTS = 30; // 최대 대기 시도 횟수
        
        const checkCommentsInterval = setInterval(() => {
            checkAttempts++;
            if (checkAttempts > MAX_CHECK_ATTEMPTS) {
                clearInterval(checkCommentsInterval);
                debugLog(`최대 대기 시도 횟수(${MAX_CHECK_ATTEMPTS})에 도달했습니다. 초기화 실패.`);
                
                // 그래도 버튼은 표시해서 사용자가 수동으로 시도할 수 있게 함
                if (!buttonCreated) {
                    createToggleButton();
                }
                return;
            }
            
            const commentsSection = findCommentsSection();
            if (commentsSection) {
                clearInterval(checkCommentsInterval);
                debugLog("댓글 섹션 확인됨, 초기화 계속...");

                // 댓글 숨기기 시도
                attemptHideComments();

                // 버튼 생성 또는 업데이트
                if (!buttonCreated) {
                     createToggleButton();
                } else {
                    const container = document.getElementById('yt-comments-toggle-container');
                    if (container) {
                        container.style.display = 'flex'; // 다시 표시
                    }
                    const button = document.getElementById('toggle-comments-button');
                    if (button) {
                        button.innerHTML = '';
                        button.appendChild(createCommentIcon());
                        button.appendChild(document.createTextNode(' 댓글 표시'));
                    }
                }

                // 키보드 단축키 설정
                setupKeyboardShortcut();

                initialized = true;
                debugLog("초기화 완료");
            } else {
                debugLog(`댓글 섹션 확인 시도 ${checkAttempts}/${MAX_CHECK_ATTEMPTS}`);
            }
        }, 500); // 0.5초마다 확인
    }

    // 키보드 단축키 설정 함수
    function setupKeyboardShortcut() {
        document.removeEventListener('keydown', handleKeyDown); // 기존 리스너 제거
        document.addEventListener('keydown', handleKeyDown);
    }

    function handleKeyDown(e) {
        // Alt + C 키 조합으로 댓글 토글
        if (e.altKey && e.code === 'KeyC') {
            debugLog("단축키 (Alt+C) 입력됨");
            toggleComments();
            
            // 이벤트 버블링 방지
            e.preventDefault();
            e.stopPropagation();
        }
    }

    // 페이지 변경 감지를 위한 MutationObserver 설정 (성능 최적화)
    function setupMutationObserver() {
        if (observerActive) return; // 이미 활성화되어 있으면 중복 설정 방지
        
        observerActive = true;
        debugLog("MutationObserver 설정");
        
        const observer = new MutationObserver(function(mutations) {
            // 간단한 디바운싱: 짧은 시간 내 여러 번 호출 방지
            clearTimeout(observer.debounceTimer);
            observer.debounceTimer = setTimeout(() => {
                checkForUrlChange();
                
                // 댓글 UI를 다시 찾아 숨기기 (동적 로딩 대응)
                if (window.location.href.includes('/watch') && commentsHidden && initialized) {
                    // 댓글 섹션이 다시 표시되었는지 확인
                    const commentsSection = findCommentsSection();
                    if (commentsSection && commentsSection.style.display !== 'none') {
                        debugLog("댓글 섹션이 다시 표시됨, 재숨김 시도");
                        hideComments();
                    }
                }
            }, 100);
        });

        // 효율적인 관찰을 위해 특정 요소만 관찰
        const observeTarget = document.body;
        
        // 변경 감지 옵션 최적화
        const observerConfig = {
            childList: true,
            subtree: true,
            attributeFilter: ['style', 'class'], // 스타일과 클래스 변경만 감시
            attributeOldValue: false,
            characterData: false
        };
        
        // 관찰 시작
        observer.observe(observeTarget, observerConfig);
        
        // 페이지 언로드 시 정리
        window.addEventListener('beforeunload', () => {
            observer.disconnect();
            observerActive = false;
        });
    }

    // 유튜브 이벤트 핸들러 설정 (더 안정적인 방식)
    function setupYoutubeEvents() {
        debugLog("유튜브 이벤트 핸들러 설정");
        
        // YouTube의 자체 이벤트 활용 (페이지 변경 감지)
        document.addEventListener('yt-navigate-start', (event) => {
            debugLog('yt-navigate-start 이벤트 감지');
            // 네비게이션 시작 전 기존 상태 초기화
            initialized = false;
        });
        
        document.addEventListener('yt-navigate-finish', (event) => {
            debugLog('yt-navigate-finish 이벤트 감지');
            setTimeout(checkForUrlChange, 100); // 약간의 지연 후 URL 변경 확인
        });

        document.addEventListener('yt-page-data-updated', (event) => {
            debugLog('yt-page-data-updated 이벤트 감지');
            // 데이터 업데이트 후 초기화 시도
            if (window.location.href.includes('/watch') && !initialized) {
                setTimeout(initOnVideoPage, 200);
            }
        });
        
        // 비디오 로드 이벤트도 캡처 (중요)
        document.addEventListener('yt-player-updated', (event) => {
            debugLog('yt-player-updated 이벤트 감지');
            if (window.location.href.includes('/watch') && !initialized) {
                setTimeout(initOnVideoPage, 300);
            }
        });
    }

    // DOM 변경 감지 대안 (history API 모니터링)
    function setupHistoryWatcher() {
        debugLog("History API 모니터링 설정");
        
        // 원본 함수 백업
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        // 함수 오버라이드
        history.pushState = function() {
            originalPushState.apply(this, arguments);
            debugLog('history.pushState 감지');
            setTimeout(checkForUrlChange, 100);
        };
        
        history.replaceState = function() {
            originalReplaceState.apply(this, arguments);
            debugLog('history.replaceState 감지');
            setTimeout(checkForUrlChange, 100);
        };
        
        // popstate 이벤트 리스너 (뒤로/앞으로 버튼 클릭)
        window.addEventListener('popstate', () => {
            debugLog('popstate 이벤트 감지');
            setTimeout(checkForUrlChange, 100);
        });
    }

    // 기본 초기화 함수 (개선 버전)
    function init() {
        debugLog("스크립트 초기화 시작");
        
        // 유튜브가 SPA(Single Page Application)이므로 여러 방식으로 페이지 변경 감지
        setupMutationObserver();
        setupYoutubeEvents();
        setupHistoryWatcher();
        
        // 페이지 가시성 변경 시 체크 (탭 전환 후 돌아왔을 때)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                debugLog('페이지 가시성 변경: 표시됨');
                checkForUrlChange();
                
                // 동영상 페이지에 있고 초기화되지 않았으면 초기화 시도
                if (window.location.href.includes('/watch') && !initialized) {
                    setTimeout(initOnVideoPage, 300);
                }
            }
        });

        // 페이지 로드 시 즉시 확인
        checkForUrlChange();
        
        // YouTube가 이미 로드된 상태라면 바로 초기화
        if (document.readyState === 'complete' && window.location.href.includes('/watch')) {
            setTimeout(initOnVideoPage, 500);
        }
    }

    // 스크립트 초기화 함수 - document ready 또는 DOMContentLoaded 이벤트 발생 시 호출
    function initializeScript() {
        try {
            debugLog("스크립트 초기화 함수 호출됨");
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
    
    // 백업: 윈도우 로드 이벤트 리스너
    window.addEventListener('load', () => {
        debugLog("윈도우 로드 이벤트 발생");
        // 혹시 아직 초기화되지 않았다면 다시 시도
        if (window.location.href.includes('/watch') && !initialized) {
            setTimeout(initOnVideoPage, 800);
        }
    });

    // 토글 버튼 생성 함수
    function createToggleButton() {
        debugLog("토글 버튼 생성 시도...");
        // 이미 버튼 컨테이너가 있는지 확인
        if (document.getElementById('yt-comments-toggle-container')) {
            debugLog("버튼 컨테이너가 이미 존재합니다.");
            const container = document.getElementById('yt-comments-toggle-container');
            container.style.display = 'flex'; // 혹시 숨겨져 있다면 다시 표시
            buttonCreated = true;
            return container.querySelector('#toggle-comments-button');
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
        button.appendChild(createCommentIcon());
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

        dragHandle.appendChild(createDragIcon());

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
                const settingsPanel = document.getElementById('yt-comments-settings-panel');
                if (!settingsPanel || settingsPanel.style.display === 'none') {
                    const settingsButton = document.getElementById('yt-comments-settings-button');
                    if (settingsButton) settingsButton.style.opacity = '0';
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

        settingsButton.appendChild(createSettingsIcon());

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
        debugLog("토글 버튼 생성 완료");
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

        // 디버그 모드 토글 (개발자용)
        const debugModeDiv = document.createElement('div');
        debugModeDiv.style.display = 'flex';
        debugModeDiv.style.alignItems = 'center';
        debugModeDiv.style.justifyContent = 'space-between';
        debugModeDiv.style.marginTop = '10px';

        const debugLabel = document.createElement('span');
        debugLabel.textContent = '디버그 모드';
        debugLabel.style.fontSize = '12px';

        const debugToggle = document.createElement('input');
        debugToggle.type = 'checkbox';
        debugToggle.checked = DEBUG_MODE;
        debugToggle.style.cursor = 'pointer';

        debugToggle.addEventListener('change', function() {
            // 이 함수는 전역 DEBUG_MODE 변수를 직접 수정할 수 없으므로 
            // 실제로는 작동하지 않지만 개발자를 위한 시각적 피드백으로 유지
            debugLog(`디버그 모드 ${this.checked ? '활성화' : '비활성화'} 시도 (앱 재시작 필요)`);
        });

        debugModeDiv.appendChild(debugLabel);
        debugModeDiv.appendChild(debugToggle);

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

        // 새로고침 버튼
        const refreshDiv = document.createElement('div');
        refreshDiv.style.display = 'flex';
        refreshDiv.style.alignItems = 'center';
        refreshDiv.style.justifyContent = 'space-between';
        refreshDiv.style.marginTop = '10px';

        const refreshLabel = document.createElement('span');
        refreshLabel.textContent = '스크립트 새로고침';
        refreshLabel.style.fontSize = '12px';

        const refreshButton = document.createElement('button');
        refreshButton.textContent = '새로고침';
        refreshButton.style.padding = '4px 8px';
        refreshButton.style.backgroundColor = '#3EA6FF';
        refreshButton.style.border = 'none';
        refreshButton.style.borderRadius = '4px';
        refreshButton.style.cursor = 'pointer';
        refreshButton.style.fontSize = '12px';
        refreshButton.style.fontWeight = 'bold';

        refreshButton.addEventListener('click', function() {
            debugLog("스크립트 수동 새로고침");
            // 스크립트 상태 초기화
            initialized = false;
            attempts = 0;
            
            // UI 요소 재설정
            const button = document.getElementById('toggle-comments-button');
            if (button) {
                button.innerHTML = '';
                button.appendChild(createCommentIcon());
                button.appendChild(document.createTextNode(' 댓글 표시'));
            }
            
            // 초기화 프로세스 재시작
            if (window.location.href.includes('/watch')) {
                initOnVideoPage();
            }
        });

        refreshDiv.appendChild(refreshLabel);
        refreshDiv.appendChild(refreshButton);

        // 버전 정보
        const versionDiv = document.createElement('div');
        versionDiv.style.marginTop = '15px';
        versionDiv.style.fontSize = '11px';
        versionDiv.style.color = '#AAAAAA';
        versionDiv.style.textAlign = 'center';
        // GM_info를 안전하게 사용 (존재하지 않을 경우 대비)
        const scriptVersion = (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script.version : '1.3.0';
        versionDiv.textContent = '유튜브 댓글 토글 v' + scriptVersion;

        // 컨테이너에 설정 항목들 추가
        settingsContainer.appendChild(resetPositionDiv);
        settingsContainer.appendChild(refreshDiv);
        settingsContainer.appendChild(debugModeDiv);
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
