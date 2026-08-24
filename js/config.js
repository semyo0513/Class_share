/**
 * ==================================================================
 * 🏫 삼현 수업나눔한마당 웹 애플리케이션 환경설정
 * ==================================================================
 */
const CONFIG = {
  // Google Apps Script 웹 앱 배포 URL (배포 후 아래 "YOUR_GAS_DEPLOYMENT_URL_HERE" 부분을 교체하세요)
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbzGoOEPSe4BbjBTDAtomX4NL_IU0ivjOUXbn-ZKj8nnJ3-wv8_a4wI9otSWtEf3WN9u/exec", 
  
  // 앱 기본 명칭
  APP_TITLE: "2026 삼현 수업나눔한마당",

  // 기본 관리자 비밀번호 (GAS 미연동 데모 모드용)
  DEMO_ADMIN_PASSWORD: "admin1234!",
  
  // 교과목 카테고리 태그 목록
  SUBJECT_CATEGORIES: [
    "국어",
    "수학",
    "영어",
    "사회/역사",
    "과학",
    "음악/미술/체육",
    "기술가정/정보",
    "진로/교양"
  ],

  // 게시판 카테고리 목록
  BOARD_CATEGORIES: [
    "사전질의",
    "수업후기",
    "자료요청",
    "자유소통"
  ]
};
