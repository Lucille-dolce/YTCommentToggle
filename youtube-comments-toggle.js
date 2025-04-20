// ==UserScript==
// @name         YouTube 댓글 토글
// @namespace    https://github.com/Lucille-dolce
// @version      1.4.0
// @description  유튜브 댓글을 기본적으로 숨기고 토글 버튼으로 표시/숨기기 할 수 있음 [제작: Cursor, Sonnet 3.7 Thinking 외]
// @author       Lucille
// @updateURL    https://raw.githubusercontent.com/Lucille-dolce/YTCommentToggle/main/youtube-comments-toggle.js
// @downloadURL  https://raw.githubusercontent.com/Lucille-dolce/YTCommentToggle/main/youtube-comments-toggle.js
// @match        https://www.youtube.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 설정 및 상태 관리 변수
    let commentsHidden = true;
    let currentUrl = window.location.href;
    let initialized = false;
    let attempts = 0;
    let MAX_ATTEMPTS = 20;
    let buttonCreated = false;
    let isDragging = false;
    let offsetX, offsetY;
    let initializationTimer = null;
    let observerActive = false;
    let userAction = false;
    let preventReHideTimer = null;
    
    // 디버깅 모드 설정
    const DEBUG_MODE = true;
    
    // 최근 로그 메시지를 저장하여 중복 출력 방지
    let lastLogMessage = '';
    let lastLogTime = 0;
    
    // 로그 출력 함수
    function debugLog(...args) {
        if (!DEBUG_MODE) return;
        
        const message = args.join(' ');
        const now = Date.now();
        
        // 100ms 내에 같은 메시지가 나오면 출력하지 않음
        if (message === lastLogMessage && now - lastLogTime < 100) {
            return;
        }
        
        console.log("[유튜브 댓글 토글 최적화]", ...args);
        lastLogMessage = message;
        lastLogTime = now;
    }

    // CSP 및 TrustedHTML 보안 정책 우회를 위한 안전한 DOM 조작 기능
    const DOMHelper = {
        // 요소의 모든 자식 노드 제거 함수
        removeAllChildren(element) {
            if (!element) return;
            try {
                while (element.firstChild) {
                    element.removeChild(element.firstChild);
                }
            } catch (error) {
                debugLog("자식 노드 제거 중 오류 발생:", error.message);
            }
        },
        
        // 안전한 요소 내용 변경 함수
        setContent(element, ...contents) {
            if (!element) return;
            try {
                // 기존 내용 제거
                this.removeAllChildren(element);
                
                // 새 내용 추가
                contents.forEach(content => {
                    if (typeof content === 'string') {
                        element.appendChild(document.createTextNode(content));
                    } else if (content instanceof Node) {
                        element.appendChild(content);
                    }
                });
            } catch (error) {
                debugLog("요소 내용 변경 중 오류 발생:", error.message);
                
                // 오류 발생 시 대체 방법 시도
                try {
                    element.textContent = contents
                        .filter(content => typeof content === 'string')
                        .join(' ');
                } catch (e) {
                    debugLog("대체 내용 설정 방법도 실패:", e.message);
                }
            }
        },
        
        // 요소 스타일 안전하게 설정
        setStyle(element, styles) {
            if (!element || !styles) return;
            try {
                Object.entries(styles).forEach(([property, value]) => {
                    element.style[property] = value;
                });
            } catch (error) {
                debugLog("스타일 설정 중 오류 발생:", error.message);
                
                // cssText 대체 방법 시도
                try {
                    const cssText = Object.entries(styles)
                        .map(([prop, val]) => `${prop}: ${val} !important`)
                        .join('; ');
                    element.style.cssText += cssText;
                } catch (e) {
                    debugLog("스타일 설정 대체 방법도 실패:", e.message);
                }
            }
        },
        
        // 요소 생성 및 설정 함수
        createElement(tagName, options = {}) {
            try {
                const element = document.createElement(tagName);
                
                // 속성 설정
                if (options.attributes) {
                    Object.entries(options.attributes).forEach(([attr, value]) => {
                        element.setAttribute(attr, value);
                    });
                }
                
                // 스타일 설정
                if (options.styles) {
                    this.setStyle(element, options.styles);
                }
                
                // 이벤트 리스너 설정
                if (options.events) {
                    Object.entries(options.events).forEach(([event, handler]) => {
                        element.addEventListener(event, handler);
                    });
                }
                
                // 내용 설정
                if (options.content) {
                    if (Array.isArray(options.content)) {
                        this.setContent(element, ...options.content);
                    } else {
                        this.setContent(element, options.content);
                    }
                }
                
                // 자식 요소 추가
                if (options.children) {
                    options.children.forEach(child => {
                        if (child) element.appendChild(child);
                    });
                }
                
                return element;
            } catch (error) {
                debugLog("요소 생성 중 오류 발생:", error.message);
                return null;
            }
        }
    };

    // 간소화를 위해 DOMHelper 메서드를 직접 호출할 수 있도록 별칭 설정
    const removeAllChildren = (...args) => DOMHelper.removeAllChildren(...args);
    const safelySetContent = (...args) => DOMHelper.setContent(...args);
    const safelySetStyle = (...args) => DOMHelper.setStyle(...args);
    const createElementSafely = (...args) => DOMHelper.createElement(...args);

    // 버튼 위치 설정 - 저장된 값이 없으면 기본값 사용
    let buttonPosition = {
        top: null,
        left: null,
        right: '20px',
        bottom: '80px'
    };

    // 저장된 위치 불러오기
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

    // 안전한 SVG 요소 생성 함수
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

    // 댓글 섹션 찾기 (특정 레이아웃 최적화 버전)
    function findCommentsSection() {
        // 동영상 페이지에 있는지 확인
        if (!window.location.href.includes('/watch')) {
            return null;
        }

        debugLog("댓글 섹션 탐색 시작");
        
        // 사용자가 지정한 특정 레이아웃 우선 찾기
        // <div id="below" class="style-scope ytd-watch-flexy"> 안의 <ytd-comments id="comments">
        try {
            const specificLayout = document.querySelector('div#below > ytd-comments#comments');
            if (specificLayout) {
                debugLog('지정된 레이아웃 댓글 섹션 발견: div#below > ytd-comments#comments');
                return specificLayout;
            }
            
            // 약간 다른 변형도 시도
            const specificLayoutAlt = document.querySelector('div#below ytd-comments#comments');
            if (specificLayoutAlt) {
                debugLog('지정된 레이아웃 변형 발견: div#below ytd-comments#comments');
                return specificLayoutAlt;
            }
        } catch (err) {
            debugLog('지정 레이아웃 검색 중 오류:', err.message);
        }
        
        // ID로 직접 찾기 (가장 일반적인 방법)
        try {
            const commentsById = document.querySelector('ytd-comments#comments');
            if (commentsById) {
                debugLog('ID로 댓글 섹션 발견: ytd-comments#comments');
                return commentsById;
            }
        } catch (err) {
            debugLog('ID 검색 중 오류:', err.message);
        }
        
        // 백업 방법: 몇 가지 일반적인 선택자 시도
        const backupSelectors = [
            '#comments',
            'ytd-watch-flexy #comments',
            '#primary-inner #comments',
            '#below ytd-comments',
            'ytd-watch-flexy div#below ytd-comments'
        ];
        
        for (const selector of backupSelectors) {
            try {
                const element = document.querySelector(selector);
                if (element && element.offsetParent !== null) {
                    debugLog('백업 선택자로 댓글 섹션 발견:', selector);
                    return element;
                }
            } catch (err) {
                // 오류 로깅 생략 (과도한 로그 방지)
            }
        }
        
        // 최후의 시도: DOM 순회로 찾기
        try {
            // below 컨테이너 찾기
            const belowContainer = document.getElementById('below');
            if (belowContainer) {
                // below 내부에서 comments 요소 찾기
                const commentsInBelow = belowContainer.querySelector('ytd-comments') || 
                                      belowContainer.querySelector('#comments');
                if (commentsInBelow) {
                    debugLog('DOM 순회로 댓글 섹션 발견');
                    return commentsInBelow;
                }
            }
        } catch (err) {
            debugLog('DOM 순회 검색 중 오류:', err.message);
        }

        debugLog('댓글 섹션을 찾지 못했습니다');
        return null;
    }

    // 댓글 섹션에 적용할 숨김 스타일
    function applyHiddenStyle(element) {
        try {
            if (!element) return false;
            
            // 다양한 속성 사용으로 확실하게 숨김
            element.style.display = 'none';
            element.style.visibility = 'hidden';
            element.style.opacity = '0';
            element.style.height = '0';
            element.style.overflow = 'hidden';
            
            // !important 플래그 사용
            element.style.cssText += 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
            
            // 클래스 기반 숨김 처리 추가
            element.classList.add('yt-comments-hidden');
            
            return true;
        } catch (error) {
            debugLog("스타일 적용 중 오류 발생:", error.message);
            return false;
        }
    }

    // 댓글 섹션을 보이게 하는 스타일 적용
    function applyVisibleStyle(element) {
        try {
            if (!element) return false;
            
            // 이전에 적용한 스타일 초기화
            element.style.display = '';
            element.style.visibility = '';
            element.style.opacity = '';
            element.style.height = '';
            element.style.overflow = '';
            
            // 요소가 여전히 숨겨져 있다면 강제로 보이게 함
            const computedStyle = window.getComputedStyle(element);
            if (computedStyle.display === 'none') {
                element.style.display = 'block';
                element.style.visibility = 'visible';
                element.style.opacity = '1';
            }
            
            // 클래스 제거
            element.classList.remove('yt-comments-hidden');
            
            return true;
        } catch (error) {
            debugLog("스타일 적용 중 오류 발생:", error.message);
            return false;
        }
    }

    // 댓글 숨기기 함수
    function hideComments() {
        const commentsSection = findCommentsSection();
        if (commentsSection) {
            try {
                if (applyHiddenStyle(commentsSection)) {
                    commentsHidden = true;
                    
                    // 버튼 텍스트 업데이트
                    const button = document.getElementById('toggle-comments-button');
                    if (button) {
                        safelySetContent(button, createCommentIcon(), ' 댓글 표시');
                    }
                    debugLog("댓글이 숨겨졌습니다");
                    
                    // DOM 변경사항 반영 확인
                    requestAnimationFrame(() => {
                        if (commentsSection.offsetParent !== null) {
                            debugLog("첫 시도 후에도 댓글 섹션이 여전히 보입니다. 추가 시도 중...");
                            // 부모 요소를 통한 숨김 시도
                            const parent = commentsSection.parentElement;
                            if (parent) {
                                try {
                                    const originalDisplay = parent.style.display;
                                    parent.setAttribute('data-original-display', originalDisplay);
                                    parent.style.cssText += 'height: 0 !important; overflow: hidden !important;';
                                } catch (e) {
                                    debugLog("부모 요소 숨김 시도 중 오류:", e.message);
                                }
                            }
                        }
                    });
                    
                    return true;
                }
            } catch (error) {
                debugLog("댓글 숨기기 중 오류 발생:", error.message);
            }
        }
        debugLog("댓글 숨기기 실패: 댓글 섹션을 찾을 수 없습니다");
        return false;
    }

    // 댓글 표시/숨기기 토글 함수
    function toggleComments() {
        debugLog("댓글 토글 함수 실행");
        userAction = true; // 사용자 액션 플래그 설정
        
        // 이전 타이머가 있다면 취소
        if (preventReHideTimer) {
            clearTimeout(preventReHideTimer);
        }
        
        try {
            const commentsSection = findCommentsSection();
            const button = document.getElementById('toggle-comments-button');

            if (commentsSection) {
                debugLog("댓글 섹션 발견, 토글 시도 중...");
                
                if (commentsHidden) {
                    // 댓글 표시
                    if (applyVisibleStyle(commentsSection)) {
                        // 혹시 부모 요소도 숨겨져 있었다면 복원
                        const parent = commentsSection.parentElement;
                        if (parent && parent.hasAttribute('data-original-display')) {
                            try {
                                const originalDisplay = parent.getAttribute('data-original-display');
                                parent.style.height = '';
                                parent.style.overflow = '';
                                if (originalDisplay) {
                                    parent.style.display = originalDisplay;
                                }
                                parent.removeAttribute('data-original-display');
                            } catch (e) {
                                debugLog("부모 요소 복원 중 오류:", e.message);
                            }
                        }
                        
                        if (button) {
                            safelySetContent(button, createCommentIcon(), ' 댓글 숨기기');
                        }
                        commentsHidden = false;
                        debugLog("댓글이 표시되었습니다");
                    } else {
                        debugLog("댓글 표시 실패");
                    }
                } else {
                    // 댓글 숨기기
                    if (applyHiddenStyle(commentsSection)) {
                        if (button) {
                            safelySetContent(button, createCommentIcon(), ' 댓글 표시');
                        }
                        commentsHidden = true;
                        debugLog("댓글이 숨겨졌습니다");
                    } else {
                        debugLog("댓글 숨기기 실패");
                    }
                }
                
                // 사용자 액션 후 5초 동안 자동 재숨김 방지
                preventReHideTimer = setTimeout(() => {
                    userAction = false;
                }, 5000);
            } else {
                debugLog("토글 실패: 댓글 섹션을 찾을 수 없습니다");
                // 댓글 섹션을 찾지 못한 경우 재시도
                attempts = 0;
                attemptHideComments();
            }
        } catch (error) {
            debugLog("댓글 토글 중 오류 발생:", error.message);
        }
    }

    // 재시도 메커니즘으로 댓글 숨기기
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

    // URL 변경 감지 및 처리
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
            
            // 사용자 액션 플래그 리셋
            userAction = false;
            
            // 동영상 페이지 진입 시
            if (newUrl.includes('/watch')) {
                debugLog("동영상 페이지 진입, 초기화 시도...");
                initialized = false;
                commentsHidden = true; // 새 페이지 진입 시 항상 숨김 상태로 초기화
                
                // 지연 후 초기화 (유튜브가 DOM을 완전히 업데이트할 시간 제공)
                initializationTimer = setTimeout(() => {
                    initOnVideoPage();
                }, 600);
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

    // 동영상 페이지에서 초기화
    function initOnVideoPage() {
        if (initialized) return;
        debugLog("initOnVideoPage 실행");

        // 댓글 섹션이 나타날 때까지 기다림
        let checkAttempts = 0;
        const MAX_CHECK_ATTEMPTS = 30;
        
        const checkCommentsInterval = setInterval(() => {
            checkAttempts++;
            if (checkAttempts > MAX_CHECK_ATTEMPTS) {
                clearInterval(checkCommentsInterval);
                debugLog(`최대 대기 시도 횟수(${MAX_CHECK_ATTEMPTS})에 도달했습니다. 그래도 계속 진행합니다.`);
                
                // 버튼은 표시해서 사용자가 수동으로 시도할 수 있게 함
                if (!buttonCreated) {
                    createToggleButton();
                }
                
                initialized = true;
                return;
            }
            
            const commentsSection = findCommentsSection();
            if (commentsSection) {
                clearInterval(checkCommentsInterval);
                debugLog("댓글 섹션 확인됨, 초기화 계속...");

                // 댓글 숨기기 시도
                if (!hideComments()) {
                    debugLog("첫 번째 숨기기 시도 실패, 다른 방법 시도...");
                    
                    // 직접 스타일 적용 시도
                    try {
                        commentsSection.style.cssText += 'display: none !important; visibility: hidden !important;';
                        commentsHidden = true;
                        debugLog("강제 스타일 적용으로 댓글 숨기기 시도");
                    } catch (e) {
                        debugLog("강제 스타일 적용 실패:", e.message);
                    }
                }

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
                        safelySetContent(button, createCommentIcon(), ' 댓글 표시');
                    }
                }

                // 키보드 단축키 설정
                setupKeyboardShortcut();

                initialized = true;
                debugLog("초기화 완료");
            } else {
                // 숨겨진 로그: 과도한 출력 방지
                if (checkAttempts % 5 === 0) {
                    debugLog(`댓글 섹션 확인 시도 ${checkAttempts}/${MAX_CHECK_ATTEMPTS}`);
                }
            }
        }, 300);
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

    // 페이지 변경 감지를 위한 MutationObserver 설정
    function setupMutationObserver() {
        if (observerActive) return; // 이미 활성화되어 있으면 중복 설정 방지
        
        observerActive = true;
        debugLog("MutationObserver 설정");
        
        // 디바운싱 간격 늘림
        let lastObserverCheck = 0;
        const OBSERVER_THROTTLE = 250; // ms
        
        const observer = new MutationObserver(function(mutations) {
            // 스로틀링 적용: 마지막 실행 후 일정 시간이 지나야 다시 실행
            const now = Date.now();
            if (now - lastObserverCheck < OBSERVER_THROTTLE) return;
            lastObserverCheck = now;
            
            // URL 변경 확인
            checkForUrlChange();
            
            // 댓글 UI를 다시 찾아 숨기기 (동적 로딩 대응)
            // 사용자가 명시적으로 표시했을 경우에는 자동 숨기기 방지
            if (window.location.href.includes('/watch') && 
                commentsHidden && 
                initialized && 
                !userAction) {
                
                // 댓글 섹션이 다시 표시되었는지 확인
                const commentsSection = findCommentsSection();
                if (commentsSection && commentsSection.style.display !== 'none') {
                    debugLog("댓글 섹션이 다시 표시됨, 재숨김 시도");
                    hideComments();
                }
            }
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
    }

    // 유튜브 이벤트 핸들러 설정
    function setupYoutubeEvents() {
        debugLog("유튜브 이벤트 핸들러 설정");
        
        // YouTube 네비게이션 이벤트 활용
        document.addEventListener('yt-navigate-start', () => {
            debugLog('yt-navigate-start 이벤트 감지');
            initialized = false;
            userAction = false; // 페이지 이동 시 사용자 액션 플래그 초기화
        });
        
        document.addEventListener('yt-navigate-finish', () => {
            debugLog('yt-navigate-finish 이벤트 감지');
            setTimeout(checkForUrlChange, 100);
        });

        document.addEventListener('yt-page-data-updated', () => {
            debugLog('yt-page-data-updated 이벤트 감지');
            if (window.location.href.includes('/watch') && !initialized) {
                setTimeout(initOnVideoPage, 300);
            }
        });
    }

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
        safelySetContent(button, createCommentIcon(), ' 댓글 표시');

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

        // 안전하게 드래그 핸들에 아이콘 추가
        safelySetContent(dragHandle, createDragIcon());

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

        // 컨테이너에 버튼 추가
        container.appendChild(button);
        container.appendChild(dragHandle);

        document.body.appendChild(container);
        buttonCreated = true;
        debugLog("토글 버튼 생성 완료");
        return button;
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

    // 기본 초기화 함수
    function init() {
        debugLog("스크립트 초기화 시작");
        
        // 유튜브가 SPA(Single Page Application)이므로 여러 방식으로 페이지 변경 감지
        setupMutationObserver();
        setupYoutubeEvents();
        
        // 히스토리 변경 감지 (URL 변경 감지용)
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function() {
            originalPushState.apply(this, arguments);
            setTimeout(checkForUrlChange, 100);
        };
        
        history.replaceState = function() {
            originalReplaceState.apply(this, arguments);
            setTimeout(checkForUrlChange, 100);
        };
        
        window.addEventListener('popstate', () => {
            setTimeout(checkForUrlChange, 100);
        });
        
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
            setTimeout(initOnVideoPage, 800);
        }
    }

    // 스크립트 초기화
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

})(); 
