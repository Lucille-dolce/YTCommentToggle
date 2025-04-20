// ==UserScript==
// @name         YouTube 댓글 토글
// @namespace    https://github.com/Lucille-dolce
// @version      1.0
// @description  유튜브 댓글을 기본적으로 숨기고 토글 버튼으로 표시/숨기기 할 수 있음 [제작: 클로드 소넷 3.7 Thinking]
// @author       Lucille
// @updateURL    https://raw.githubusercontent.com/Lucille-dolce/YTCommentToggle/main/youtube-comments-toggle.js
// @downloadURL  https://raw.githubusercontent.com/Lucille-dolce/YTCommentToggle/main/youtube-comments-toggle.js
// @match        https://www.youtube.com/watch*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    // 댓글 표시 상태 추적용 변수
    let commentsHidden = true;
    
    // 토글 버튼 생성 함수
    function createToggleButton() {
        // 이미 버튼이 있는지 확인
        if (document.getElementById('toggle-comments-button')) {
            return document.getElementById('toggle-comments-button');
        }
        
        const button = document.createElement('button');
        button.id = 'toggle-comments-button';
        button.textContent = '댓글 표시';
        button.style.position = 'fixed';
        button.style.bottom = '20px';
        button.style.right = '20px';
        button.style.zIndex = '9999';
        button.style.padding = '8px 12px';
        button.style.backgroundColor = '#FF0000';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '18px';
        button.style.cursor = 'pointer';
        button.style.fontWeight = 'bold';
        button.style.fontSize = '14px';
        button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
        button.style.opacity = '0.9';
        button.style.transition = 'opacity 0.3s, transform 0.2s';
        
        // 마우스 오버 효과
        button.addEventListener('mouseover', function() {
            this.style.opacity = '1';
            this.style.transform = 'scale(1.05)';
        });
        button.addEventListener('mouseout', function() {
            this.style.opacity = '0.9';
            this.style.transform = 'scale(1)';
        });
        
        // 클릭 이벤트
        button.addEventListener('click', toggleComments);
        
        document.body.appendChild(button);
        return button;
    }
    
    // 댓글 섹션 찾기 (여러 선택자 시도)
    function findCommentsSection() {
        const selectors = [
            '#comments', 
            'ytd-comments#comments',
            '#comment-section',
            '#comment-teaser',
            'ytd-item-section-renderer#sections'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element;
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
                button.textContent = '댓글 숨기기';
                commentsHidden = false;
            } else {
                commentsSection.style.display = 'none';
                button.textContent = '댓글 표시';
                commentsHidden = true;
            }
        }
    }
    
    // 댓글 숨기기 함수
    function hideComments() {
        const commentsSection = findCommentsSection();
        if (commentsSection) {
            commentsSection.style.display = 'none';
        }
    }
    
    // 초기화 함수
    function init() {
        // 처음에 댓글 숨기기
        hideComments();
        
        // 토글 버튼 생성
        createToggleButton();
        
        // DOM 변화 감지 관찰자 추가
        const observer = new MutationObserver(function(mutations) {
            const commentsSection = findCommentsSection();
            
            if (commentsSection && commentsHidden) {
                hideComments();
            }
        });
        
        // DOM 변화 감시 시작
        observer.observe(document.body, { childList: true, subtree: true });
        
        // 키보드 단축키 추가 (Alt+C)
        document.addEventListener('keydown', function(e) {
            if (e.altKey && e.key === 'c') {
                toggleComments();
            }
        });
    }
    
    // 유튜브 로드 후 스크립트 실행하기 위한 딜레이
    setTimeout(init, 2000);
    
    // 다른 영상으로 이동할 때 재초기화
    window.addEventListener('yt-navigate-finish', function() {
        setTimeout(function() {
            hideComments();
            createToggleButton();
        }, 1000);
    });
})();