# 0. 프로젝트 환경

- React 19
- JavaScript
- TanStack/React-Query
- Axios
- Tailwind
- Zustand

# 1. 기본 원칙

- 동일한 역할의 Axios 인스턴스, API 함수, Query Client, 전역 스토어 중복 생성 금지
- 불필요한 추상화, 과도한 예외처리 금지
- 빌드 테스트는 수행하지 말 것
- Zustand를 통한 상태관리에 이점이 존재할때만 이를 활용할 것. 만약 Zustand 관련 추가, 수정, 제거 사항이 있다면 반드시 알릴것.

# 2. 주석

- 기능 변경으로 인해 주석 내용이 달라져야 하는 경우가 아니면 기존 주석을 수정하거나 제거 금지
- 새 주석은 한글 개조식으로 간단하게 작성하며 불필요한 주석 금지
- 주석에 파일명이나 폴더명을 설명하지 말 것

# 6. 파일·import·포맷 규칙

- 폴더는 소문자, 여러 단어는 kebab-case
- 컴포넌트는 PascalCase .jsx, 대표 컴포넌트명과 파일명 일치
- 라우트는 *Page.jsx, 기능 화면은 *View.jsx
- 모델 훅은 use*.js, API는 *Api.js, 순수 모듈은 역할을 나타내는 camelCase.js
- 컴포넌트는 default export, 훅·API·순수 함수는 named export
- 같은 기능 내부는 상대 import, 기능 경계를 넘으면 @/ 별칭 사용
- Prettier 설정 적용: 공백 2칸, 큰따옴표, 세미콜론
- 계층 규칙을 통과시키기 위해 ESLint를 임의로 비활성화하지 말 것
